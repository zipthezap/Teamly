import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../error/app_exception.dart';
import 'auth_token_store.dart';

final tokenStoreProvider = Provider<AuthTokenStore>(
  (ref) => AuthTokenStore(const FlutterSecureStorage()),
);

String _extractErrorMessage(DioException error) {
  final data = error.response?.data;

  if (data is Map<String, dynamic>) {
    final message = data['message']?.toString();
    if (message != null && message.isNotEmpty) {
      return message;
    }
    return 'Unknown API error';
  }

  return error.message ?? 'Network error';
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

  return dio;
});
