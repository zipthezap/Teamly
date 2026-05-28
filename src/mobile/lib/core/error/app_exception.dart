class AppException implements Exception {
  const AppException(this.message, {this.statusCode, this.field});

  final String message;
  final int? statusCode;
  final String? field;

  @override
  String toString() => 'AppException(statusCode: $statusCode, field: $field, message: $message)';
}

class NetworkException extends AppException {
  const NetworkException(super.message, {super.statusCode});
}

class ValidationException extends AppException {
  const ValidationException(super.message, {super.statusCode, super.field});
}

class AuthException extends AppException {
  const AuthException(super.message, {super.statusCode});
}

class ConflictException extends AppException {
  const ConflictException(super.message, {super.statusCode});
}

class ServerException extends AppException {
  const ServerException(super.message, {super.statusCode});
}
