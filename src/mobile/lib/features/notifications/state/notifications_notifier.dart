import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/notification_model.dart';
import '../data/notification_repository_impl.dart';
import '../domain/notification_repository.dart';
import '../../push_notifications/state/push_notifications_controller.dart';

// ---------------------------------------------------------------------------
// Notifications list
// ---------------------------------------------------------------------------

class NotificationsNotifier
    extends StateNotifier<AsyncValue<List<NotificationModel>>> {
  NotificationsNotifier(this._repo, this._ref) : super(const AsyncValue.loading()) {
    load();
  }

  final NotificationRepository _repo;
  final Ref _ref;

  Future<void> load({bool includeRead = false}) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => _repo.getNotifications(includeRead: includeRead),
    );
    await _safeBadgeSync();
  }

  Future<void> markAllRead() async {
    await _repo.markAllRead();
    // Optimistically update local state
    state.whenData((list) {
      state = AsyncValue.data(list.map(_markRead).toList());
    });
    await _safeBadgeSync();
  }

  Future<void> markRead(String id) async {
    await _repo.markRead([id]);
    state.whenData((list) {
      state = AsyncValue.data(
        list.map((n) => n.id == id ? _markRead(n) : n).toList(),
      );
    });
    await _safeBadgeSync();
  }
  Future<void> _safeBadgeSync() async {
    try {
      await _ref.read(pushNotificationsControllerProvider).syncBadgeCount();
    } catch (_) {
      // no-op
    }
  }
  NotificationModel _markRead(NotificationModel n) {
    return NotificationModel(
      id: n.id,
      type: n.type,
      notificationType: n.notificationType,
      read: true,
      createdAt: n.createdAt,
      eventId: n.eventId,
      eventTitle: n.eventTitle,
      groupId: n.groupId,
      groupName: n.groupName,
      tournamentId: n.tournamentId,
      tournamentName: n.tournamentName,
      teamupId: n.teamupId,
      actorName: n.actorName,
      params: n.params,
    );
  }
}

final notificationsNotifierProvider = StateNotifierProvider<NotificationsNotifier,
    AsyncValue<List<NotificationModel>>>((ref) {
  return NotificationsNotifier(ref.watch(notificationRepositoryProvider), ref);
});

// ---------------------------------------------------------------------------
// Unread count (polled on demand)
// ---------------------------------------------------------------------------

final unreadCountProvider = FutureProvider<int>((ref) async {
  return ref.watch(notificationRepositoryProvider).getUnreadCount();
});
