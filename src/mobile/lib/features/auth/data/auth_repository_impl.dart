import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/auth_token_store.dart';
import '../domain/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._dio, this._tokenStore);

  final Dio _dio;
  final AuthTokenStore _tokenStore;

  @override
  Future<String> login({required String email, required String password}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': email, 'password': password},
    );

    final token = response.data?['token']?.toString();
    if (token == null || token.isEmpty) {
      throw const FormatException('Missing token in login response');
    }

    await _tokenStore.saveToken(token);
    return token;
  }

  @override
  Future<void> logout() => _tokenStore.clear();

  @override
  Future<String?> getToken() => _tokenStore.getToken();
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final tokenStore = ref.watch(tokenStoreProvider);
  return AuthRepositoryImpl(dio, tokenStore);
});
