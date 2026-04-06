import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/notification_preferences_repository.dart';

class NotificationPreferencesRepositoryImpl
    implements NotificationPreferencesRepository {
  NotificationPreferencesRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<Map<String, bool>> getPreferences() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/notification-preferences');
    final data = response.data ?? {};
    return Map.fromEntries(
      data.entries
          .where((e) => e.value is bool)
          .map((e) => MapEntry(e.key, e.value as bool)),
    );
  }

  @override
  Future<void> updatePreferences(Map<String, bool> prefs) async {
    await _dio.put<void>('/notification-preferences', data: prefs);
  }
}

final notificationPreferencesRepositoryProvider =
    Provider<NotificationPreferencesRepository>((ref) {
  return NotificationPreferencesRepositoryImpl(ref.watch(dioProvider));
});

final notificationPreferencesProvider =
    FutureProvider<Map<String, bool>>((ref) async {
  return ref.watch(notificationPreferencesRepositoryProvider).getPreferences();
});
