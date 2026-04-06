import '../../../core/models/notification_model.dart';

abstract class NotificationRepository {
  Future<List<NotificationModel>> getNotifications({bool includeRead = false});
  Future<int> getUnreadCount();
  Future<void> markAllRead();
  Future<void> markRead(List<String> ids);
}
