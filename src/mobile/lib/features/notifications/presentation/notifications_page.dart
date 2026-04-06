import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../state/notifications_notifier.dart';

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  bool _includeRead = false;

  @override
  Widget build(BuildContext context) {
    final notificationsAsync = ref.watch(notificationsNotifierProvider);
    final theme = Theme.of(context);

    return MobileShell(
      title: 'Notifications',
      currentIndex: 4,
      actions: [
        // Toggle showing read notifications
        IconButton(
          icon: Icon(
            _includeRead ? Icons.visibility_outlined : Icons.visibility_off_outlined,
            semanticLabel: _includeRead ? 'Hide read' : 'Show read',
          ),
          tooltip: _includeRead ? 'Hide read' : 'Show all',
          onPressed: () {
            setState(() => _includeRead = !_includeRead);
            ref
                .read(notificationsNotifierProvider.notifier)
                .load(includeRead: _includeRead);
          },
        ),
        // Mark all as read
        IconButton(
          icon: const Icon(Icons.done_all),
          tooltip: 'Mark all read',
          onPressed: () async {
            await ref
                .read(notificationsNotifierProvider.notifier)
                .markAllRead();
            ref.invalidate(unreadCountProvider);
          },
        ),
      ],
      child: notificationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref
              .read(notificationsNotifierProvider.notifier)
              .load(includeRead: _includeRead),
        ),
        data: (notifications) {
          if (notifications.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.notifications_none, size: 56, color: Colors.grey),
                    SizedBox(height: 12),
                    Text(
                      'No notifications.',
                      style: TextStyle(color: Colors.grey),
                    ),
                  ],
                ),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref
                .read(notificationsNotifierProvider.notifier)
                .load(includeRead: _includeRead),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: notifications.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 56),
              itemBuilder: (context, index) {
                final n = notifications[index];
                final isUnread = !n.read;
                final timeLabel = _formatTime(n.createdAt);
                final icon = _iconForType(n.notificationType);

                return Dismissible(
                  key: ValueKey(n.id),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 16),
                    color: theme.colorScheme.primaryContainer,
                    child: Icon(
                      Icons.mark_email_read_outlined,
                      color: theme.colorScheme.onPrimaryContainer,
                    ),
                  ),
                  confirmDismiss: (_) async {
                    if (!n.read) {
                      await ref
                          .read(notificationsNotifierProvider.notifier)
                          .markRead(n.id);
                      ref.invalidate(unreadCountProvider);
                    }
                    return false; // keep the item; just mark read
                  },
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: isUnread
                          ? theme.colorScheme.primaryContainer
                          : theme.colorScheme.surfaceContainerHighest,
                      child: Icon(
                        icon,
                        size: 18,
                        color: isUnread
                            ? theme.colorScheme.primary
                            : Colors.grey,
                      ),
                    ),
                    title: Text(
                      n.summary,
                      style: TextStyle(
                        fontWeight:
                            isUnread ? FontWeight.bold : FontWeight.normal,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      timeLabel,
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                    onTap: () async {
                      // Mark as read on tap
                      if (!n.read) {
                        await ref
                            .read(notificationsNotifierProvider.notifier)
                            .markRead(n.id);
                        ref.invalidate(unreadCountProvider);
                      }
                      // Navigate to related content
                      if (!context.mounted) return;
                      if (n.eventId != null) {
                        context.push('/events/${n.eventId}');
                      } else if (n.groupId != null) {
                        context.push('/groups/${n.groupId}');
                      }
                    },
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt.toLocal());
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat.yMMMd().format(dt.toLocal());
  }

  IconData _iconForType(String notificationType) {
    switch (notificationType) {
      case 'group':
        return Icons.group_outlined;
      case 'teamup':
        return Icons.handshake_outlined;
      case 'tournament':
        return Icons.emoji_events_outlined;
      default:
        return Icons.event_outlined;
    }
  }
}
