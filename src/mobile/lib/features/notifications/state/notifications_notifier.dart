import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/notification_model.dart';
import '../data/notification_repository_impl.dart';
import '../../push_notifications/state/push_notifications_controller.dart';

// ---------------------------------------------------------------------------
// Notifications list
// ---------------------------------------------------------------------------

class NotificationsNotifier
    extends AsyncNotifier<List<NotificationModel>> {

  @override
  Future<List<NotificationModel>> build() {
    return ref.watch(notificationRepositoryProvider)
        .getNotifications(includeRead: false);
  }

  Future<void> load({bool includeRead = false}) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(notificationRepositoryProvider)
          .getNotifications(includeRead: includeRead),
    );
    await _safeBadgeSync();
  }

  Future<void> markAllRead() async {
    await ref.read(notificationRepositoryProvider).markAllRead();
    // Optimistically update local state without a round-trip.
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncValue.data(current.map(_markRead).toList());
    }
    await _safeBadgeSync();
  }

  Future<void> markRead(String id) async {
    await ref.read(notificationRepositoryProvider).markRead([id]);
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncValue.data(
        current.map((n) => n.id == id ? _markRead(n) : n).toList(),
      );
    }
    await _safeBadgeSync();
  }

  Future<void> _safeBadgeSync() async {
    try {
      await ref.read(pushNotificationsControllerProvider).syncBadgeCount();
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

final notificationsNotifierProvider =
    AsyncNotifierProvider<NotificationsNotifier, List<NotificationModel>>(
        NotificationsNotifier.new);

// ---------------------------------------------------------------------------
// Unread count (polled on demand)
// ---------------------------------------------------------------------------

final unreadCountProvider = FutureProvider<int>((ref) async {
  return ref.watch(notificationRepositoryProvider).getUnreadCount();
});
