import 'package:dio/dio.dart';

import 'app_exception.dart';

/// Extracts a human-readable message from any caught error.
///
/// Handles [AppException], [DioException] (including nested [AppException]),
/// and arbitrary exceptions, stripping the "Exception: " prefix where present.
String extractErrorMessage(Object error) {
  if (error is ValidationException) {
    return error.field != null ? '${error.message} (${error.field})' : error.message;
  }
  if (error is AuthException) {
    if (error.statusCode == 401) return 'Your session expired. Please sign in again.';
    if (error.statusCode == 403) return 'You do not have permission to perform this action.';
    return error.message;
  }
  if (error is ConflictException) return error.message;
  if (error is ServerException) return 'The server encountered an error. Please try again.';
  if (error is NetworkException) return error.message;
  if (error is AppException) return error.message;
  if (error is DioException) {
    final inner = error.error;
    if (inner is AppException) return inner.message;
    if (error.type == DioExceptionType.connectionError) {
      return 'No internet connection. Check your network and try again.';
    }
    if (error.type == DioExceptionType.connectionTimeout || error.type == DioExceptionType.receiveTimeout) {
      return 'Request timed out. Please try again.';
    }
    return error.message ?? 'Network error';
  }
  final msg = error.toString();
  if (msg.startsWith('Exception: ')) return msg.substring(11);
  return msg;
}
