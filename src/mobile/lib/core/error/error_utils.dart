import 'package:dio/dio.dart';

import 'app_exception.dart';

/// Extracts a human-readable message from any caught error.
///
/// Handles [AppException], [DioException] (including nested [AppException]),
/// and arbitrary exceptions, stripping the "Exception: " prefix where present.
String extractErrorMessage(Object error) {
  if (error is AppException) return error.message;
  if (error is DioException) {
    final inner = error.error;
    if (inner is AppException) return inner.message;
    return error.message ?? 'Network error';
  }
  final msg = error.toString();
  if (msg.startsWith('Exception: ')) return msg.substring(11);
  return msg;
}
