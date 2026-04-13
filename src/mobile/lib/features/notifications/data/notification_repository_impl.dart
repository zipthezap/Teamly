import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/notification_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/notification_repository.dart';

class NotificationRepositoryImpl implements NotificationRepository {
  NotificationRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<(List<NotificationModel>, String?)> getNotifications({
    bool includeRead = false,
    String? cursor,
    int limit = 50,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/notifications',
      queryParameters: {
        'includeRead': includeRead.toString(),
        'limit': limit.toString(),
        if (cursor != null) 'cursor': cursor,
      },
    );
    final items =
        (response.data?['notifications'] as List<dynamic>?) ?? [];
    final notifications = items
        .map((e) => NotificationModel.fromJson(e as Map<String, dynamic>))
        .toList();
    final nextCursor = response.data?['nextCursor'] as String?;
    return (notifications, nextCursor);
  }

  @override
  Future<int> getUnreadCount() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/notifications/unread-count');
    return (response.data?['count'] as num?)?.toInt() ?? 0;
  }

  @override
  Future<void> markAllRead() async {
    await _dio.put<void>('/notifications/read');
  }

  @override
  Future<void> markRead(List<String> ids) async {
    await _dio.put<void>(
      '/notifications/read',
      data: {'notificationIds': ids},
    );
  }
}

final notificationRepositoryProvider =
    Provider<NotificationRepository>((ref) {
  return NotificationRepositoryImpl(ref.watch(dioProvider));
});
