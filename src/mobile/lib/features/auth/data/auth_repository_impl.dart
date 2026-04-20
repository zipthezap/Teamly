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

  Map<String, dynamic> _requireData(
    Response<Map<String, dynamic>> response,
    String operation,
  ) {
    final data = response.data;
    if (data == null) {
      throw FormatException('Empty response payload for $operation');
    }
    return data;
  }

  Map<String, dynamic> _requireUserMap(
    dynamic raw,
    String operation,
  ) {
    if (raw is! Map<String, dynamic>) {
      throw FormatException('Invalid user payload for $operation');
    }
    return raw;
  }

  @override
  Future<UserModel> login({required String email, required String password}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'email': email, 'password': password},
    );

    final data = _requireData(response, 'login');
    final accessToken = data['accessToken']?.toString();
    final refreshToken = data['refreshToken']?.toString();

    if (accessToken == null || accessToken.isEmpty) {
      throw const FormatException('Missing accessToken in login response');
    }

    await _tokenStore.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken ?? '',
    );

    return UserModel.fromJson(_requireUserMap(data['user'], 'login'));
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

    final data = _requireData(response, 'register');
    final accessToken = data['accessToken']?.toString();
    final refreshToken = data['refreshToken']?.toString();

    if (accessToken == null || accessToken.isEmpty) {
      throw const FormatException('Missing accessToken in register response');
    }

    await _tokenStore.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken ?? '',
    );

    return UserModel.fromJson(_requireUserMap(data['user'], 'register'));
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

    final data = _requireData(response, 'social login');
    final accessToken = data['accessToken']?.toString();
    final refreshToken = data['refreshToken']?.toString();

    if (accessToken == null || accessToken.isEmpty) {
      throw const FormatException('Missing accessToken in social login response');
    }

    await _tokenStore.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken ?? '',
    );

    return UserModel.fromJson(_requireUserMap(data['user'], 'social login'));
  }

  @override
  Future<UserModel> getProfile() async {
    final response = await _dio.get<Map<String, dynamic>>('/auth/profile');
    final data = _requireData(response, 'get profile');
    final user = _requireUserMap(data['user'] ?? data, 'get profile');
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
    await _dio.delete<void>('/auth/account');
    await _tokenStore.clear();
  }

  @override
  Future<String?> getToken() => _tokenStore.getToken();
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final tokenStore = ref.watch(tokenStoreProvider);
  return AuthRepositoryImpl(dio, tokenStore);
});
