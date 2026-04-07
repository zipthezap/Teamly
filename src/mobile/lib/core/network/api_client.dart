import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../error/app_exception.dart';
import 'auth_token_store.dart';
import 'session_expired_notifier.dart';

final tokenStoreProvider = Provider<AuthTokenStore>(
  (ref) => AuthTokenStore(const FlutterSecureStorage()),
);

String _extractErrorMessage(DioException error) {
  final innerError = error.error;
  if (innerError is AppException && innerError.message.isNotEmpty) {
    return innerError.message;
  }

  final data = error.response?.data;

  if (data is Map<String, dynamic>) {
    final message = data['message']?.toString();
    if (message != null && message.isNotEmpty) {
      return message;
    }
    return 'Unknown API error';
  }

  if (error.type == DioExceptionType.connectionTimeout) {
    return 'Connection timed out while reaching the API';
  }

  if (error.type == DioExceptionType.receiveTimeout) {
    return 'API response timed out';
  }

  if (error.type == DioExceptionType.connectionError) {
    return 'Could not connect to the API server';
  }

  return error.message ?? 'Network error';
}

/// Handles transparent access-token refresh on 401 responses.
///
/// Flow:
///   1. Request fails with 401.
///   2. Attempt POST /auth/refresh-token with the stored refresh token.
///   3a. Success → save new access token, retry the original request once.
///   3b. Failure → clear all tokens, signal [sessionExpiredProvider] so the
///       [AuthNotifier] can force a logout and the router redirects to /auth.
class _TokenRefreshInterceptor extends Interceptor {
  _TokenRefreshInterceptor({
    required this.tokenStore,
    required this.baseUrl,
    required this.onSessionExpired,
  });

  final AuthTokenStore tokenStore;
  final String baseUrl;
  final void Function() onSessionExpired;

  // Guard against concurrent refresh attempts.
  bool _refreshing = false;

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final statusCode = err.response?.statusCode;

    // Only intercept 401s that aren't already coming from the refresh endpoint.
    final isRefreshCall =
        err.requestOptions.path.contains('/auth/refresh-token');

    if (statusCode == 401 && !isRefreshCall && !_refreshing) {
      _refreshing = true;
      try {
        final refreshToken = await tokenStore.getRefreshToken();
        if (refreshToken == null || refreshToken.isEmpty) {
          await _expire(handler, err);
          return;
        }

        // Use a minimal Dio instance so we don't recurse into this interceptor.
        final refreshDio = Dio(
          BaseOptions(
            baseUrl: baseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 15),
            headers: const {'Content-Type': 'application/json'},
          ),
        );

        final refreshResponse = await refreshDio.post<Map<String, dynamic>>(
          '/auth/refresh-token',
          data: {'refreshToken': refreshToken},
        );

        final newToken = refreshResponse.data?['accessToken']?.toString();
        if (newToken == null || newToken.isEmpty) {
          await _expire(handler, err);
          return;
        }

        await tokenStore.saveToken(newToken);

        // Retry the original request with the new token.
        final retryOptions = err.requestOptions;
        retryOptions.headers['Authorization'] = 'Bearer $newToken';

        final retryDio = Dio(
          BaseOptions(
            baseUrl: baseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 30),
            headers: const {'Content-Type': 'application/json'},
          ),
        );
        final retryResponse = await retryDio.fetch<dynamic>(retryOptions);
        handler.resolve(retryResponse);
      } on DioException catch (refreshErr) {
        await _expire(handler, refreshErr);
      } finally {
        _refreshing = false;
      }
    } else {
      handler.next(err);
    }
  }

  Future<void> _expire(
    ErrorInterceptorHandler handler,
    DioException err,
  ) async {
    await tokenStore.clear();
    onSessionExpired();
    handler.next(err);
  }
}

final dioProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);
  final tokenStore = ref.watch(tokenStoreProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {'Content-Type': 'application/json'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await tokenStore.getToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        // Let the token refresh interceptor run first (it is added after this
        // one), so here we only translate errors into AppException.
        final status = error.response?.statusCode;
        final message = _extractErrorMessage(error);

        handler.reject(
          DioException(
            requestOptions: error.requestOptions,
            response: error.response,
            error: AppException(message, statusCode: status),
            type: error.type,
          ),
        );
      },
    ),
  );

  dio.interceptors.add(
    _TokenRefreshInterceptor(
      tokenStore: tokenStore,
      baseUrl: config.apiBaseUrl,
      onSessionExpired: () {
        ref.read(sessionExpiredProvider.notifier).update((s) => s + 1);
      },
    ),
  );

  return dio;
});
