import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/user_model.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/auth_token_store.dart';
import '../domain/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._dio, this._tokenStore);

  final Dio _dio;
  final AuthTokenStore _tokenStore;

  @override
  Future<UserModel> login({required String email, required String password}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': email, 'password': password},
    );

    final data = response.data!;
    final accessToken = data['accessToken']?.toString();
    final refreshToken = data['refreshToken']?.toString();

    if (accessToken == null || accessToken.isEmpty) {
      throw const FormatException('Missing accessToken in login response');
    }

    await _tokenStore.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken ?? '',
    );

    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  @override
  Future<UserModel> register({
    required String email,
    required String password,
    required String name,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/register',
      data: {'email': email, 'password': password, 'name': name},
    );

    final data = response.data!;
    final accessToken = data['accessToken']?.toString();
    final refreshToken = data['refreshToken']?.toString();

    if (accessToken == null || accessToken.isEmpty) {
      throw const FormatException('Missing accessToken in register response');
    }

    await _tokenStore.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken ?? '',
    );

    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  /// Exchange a native OAuth credential for a server-issued JWT.
  ///
  /// [provider] must be one of: 'google', 'facebook', 'apple'.
  /// [credentials] must contain the provider-specific fields the backend expects:
  ///   - google   → { idToken }
  ///   - facebook → { accessToken }
  ///   - apple    → { identityToken, givenName?, familyName?, email? }
  @override
  Future<UserModel> socialLogin({
    required String provider,
    required Map<String, String> credentials,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/$provider/mobile',
      data: credentials,
    );

    final data = response.data!;
    final accessToken = data['accessToken']?.toString();
    final refreshToken = data['refreshToken']?.toString();

    if (accessToken == null || accessToken.isEmpty) {
      throw const FormatException('Missing accessToken in social login response');
    }

    await _tokenStore.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken ?? '',
    );

    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  @override
  Future<UserModel> getProfile() async {
    final response = await _dio.get<Map<String, dynamic>>('/auth/profile');
    final user = (response.data!['user'] ?? response.data!) as Map<String, dynamic>;
    return UserModel.fromJson(user);
  }

  @override
  Future<void> logout() async {
    try {
      await _dio.post<void>('/auth/logout');
    } finally {
      await _tokenStore.clear();
    }
  }

  @override
  Future<void> deleteAccount() async {
    try {
      await _dio.delete<void>('/auth/account');
    } finally {
      await _tokenStore.clear();
    }
  }

  @override
  Future<String?> getToken() => _tokenStore.getToken();
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final tokenStore = ref.watch(tokenStoreProvider);
  return AuthRepositoryImpl(dio, tokenStore);
});
