import '../../../core/models/user_model.dart';

abstract class AuthRepository {
  Future<UserModel> login({required String email, required String password});
  Future<UserModel> register({
    required String email,
    required String password,
    required String name,
  });
  Future<UserModel> socialLogin({required String provider, required Map<String, String> credentials});
  Future<UserModel> getProfile();
  Future<void> logout();
  Future<void> deleteAccount();
  Future<String?> getToken();
}
