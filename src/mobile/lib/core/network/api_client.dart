import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../error/app_exception.dart';
import 'auth_token_store.dart';

final tokenStoreProvider = Provider<AuthTokenStore>(
  (ref) => AuthTokenStore(const FlutterSecureStorage()),
);

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
        final message = error.response?.data is Map<String, dynamic>
            ? (error.response?.data['message']?.toString() ?? 'Unknown API error')
            : (error.message ?? 'Network error');

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
