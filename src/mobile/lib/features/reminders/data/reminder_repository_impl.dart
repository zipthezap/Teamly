import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/reminder_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/reminder_repository.dart';

class ReminderRepositoryImpl implements ReminderRepository {
  ReminderRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<ReminderModel>> getReminders() async {
    final response = await _dio.get<dynamic>('/reminders');
    final data = response.data;
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['reminders'] as List<dynamic>? ?? [];
    } else {
      items = [];
    }
    return items
        .map((e) => ReminderModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<ReminderModel> updateReminder(
      String reminderId, DateTime remindAt) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/reminders/$reminderId',
      data: {'remindAt': remindAt.toUtc().toIso8601String()},
    );
    final data = response.data!;
    return ReminderModel.fromJson(
        data['reminder'] as Map<String, dynamic>? ?? data);
  }

  @override
  Future<void> deleteReminder(String reminderId) async {
    await _dio.delete<void>('/reminders/$reminderId');
  }
}

final reminderRepositoryProvider = Provider<ReminderRepository>((ref) {
  return ReminderRepositoryImpl(ref.watch(dioProvider));
});
