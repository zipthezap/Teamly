import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// Repository for reading and writing the user's email notification preferences
/// via the backend `/email/preferences` endpoints.
class EmailPreferencesRepositoryImpl {
  EmailPreferencesRepositoryImpl(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> getPreferences() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/email/preferences');
    return response.data ?? {};
  }

  Future<void> updatePreferences(Map<String, dynamic> prefs) async {
    await _dio.put<void>('/email/preferences', data: prefs);
  }

  Future<void> sendVerificationEmail() async {
    await _dio.post<void>('/email/verify/send');
  }

  Future<void> verifyEmail(String token) async {
    await _dio.get<void>('/email/verify/$token');
  }
}

final emailPreferencesRepositoryProvider =
    Provider<EmailPreferencesRepositoryImpl>((ref) {
  return EmailPreferencesRepositoryImpl(ref.watch(dioProvider));
});

final emailPreferencesProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  return ref.watch(emailPreferencesRepositoryProvider).getPreferences();
});
