abstract class AuthRepository {
  Future<String> login({required String email, required String password});
  Future<void> logout();
  Future<String?> getToken();
}
