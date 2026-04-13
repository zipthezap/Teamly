import '../../../core/models/notification_model.dart';

abstract class NotificationRepository {
  /// Returns a page of notifications and an optional cursor for the next page.
  Future<(List<NotificationModel>, String?)> getNotifications(
      {bool includeRead = false, String? cursor, int limit = 50});
  Future<int> getUnreadCount();
  Future<void> markAllRead();
  Future<void> markRead(List<String> ids);
}
