import 'package:flutter/material.dart';
import '../../../core/error/error_utils.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/ui_primitives.dart';
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

    return MobileShell(
      title: 'Notifications',
      currentIndex: -1,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded),
        tooltip: 'Back',
        onPressed: () {
          if (context.canPop()) {
            context.pop();
          } else {
            context.go('/dashboard');
          }
        },
      ),
      actions: [
        IconButton(
          icon: Icon(
            _includeRead ? Icons.visibility_rounded : Icons.visibility_off_rounded,
            size: 20,
          ),
          tooltip: _includeRead ? 'Hide read' : 'Show all',
          onPressed: () {
            setState(() => _includeRead = !_includeRead);
            ref.read(notificationsNotifierProvider.notifier).load(includeRead: _includeRead);
          },
        ),
        IconButton(
          icon: const Icon(Icons.done_all_rounded, size: 20),
          tooltip: 'Mark all read',
          onPressed: () async {
            await ref.read(notificationsNotifierProvider.notifier).markAllRead();
            ref.invalidate(unreadCountProvider);
          },
        ),
      ],
      child: notificationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: extractErrorMessage(e),
          onRetry: () => ref.read(notificationsNotifierProvider.notifier).load(includeRead: _includeRead),
        ),
        data: (notifications) {
          if (notifications.isEmpty) {
            return const UiEmptyState(
              icon: Icons.notifications_none_rounded,
              title: 'All caught up!',
              message: 'No new notifications.',
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(notificationsNotifierProvider.notifier).load(includeRead: _includeRead),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: notifications.length,
              itemBuilder: (context, index) {
                final n = notifications[index];
                final isUnread = !n.read;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _NotificationCard(
                    notification: n,
                    isUnread: isUnread,
                    onTap: () async {
                      if (!n.read) {
                        await ref.read(notificationsNotifierProvider.notifier).markRead(n.id);
                        ref.invalidate(unreadCountProvider);
                      }
                      if (!context.mounted) return;
                      if (n.eventId != null) {
                        context.push('/events/${n.eventId}');
                      } else if (n.groupId != null) {
                        context.push('/groups/${n.groupId}');
                      } else if (n.tournamentId != null) {
                        context.push('/tournaments/${n.tournamentId}');
                      } else if (n.teamupId != null) {
                        context.push('/teamup');
                      }
                    },
                    onDismiss: () async {
                      if (!n.read) {
                        await ref.read(notificationsNotifierProvider.notifier).markRead(n.id);
                        ref.invalidate(unreadCountProvider);
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
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.notification,
    required this.isUnread,
    required this.onTap,
    required this.onDismiss,
  });

  final dynamic notification;
  final bool isUnread;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  IconData _iconForType(String type) {
    switch (type) {
      case 'group':
        return Icons.groups_2_rounded;
      case 'teamup':
        return Icons.handshake_rounded;
      case 'tournament':
        return Icons.emoji_events_rounded;
      case 'chat':
        return Icons.chat_bubble_rounded;
      default:
        return Icons.event_rounded;
    }
  }

  Color _colorForType(String type) {
    switch (type) {
      case 'group':
        return AppThemeTokens.primary500;
      case 'teamup':
        return const Color(0xFF7C4DFF);
      case 'tournament':
        return const Color(0xFFFF9800);
      case 'chat':
        return const Color(0xFF00BCD4);
      default:
        return const Color(0xFF4CAF50);
    }
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

  @override
  Widget build(BuildContext context) {
    final typeStr = notification.notificationType as String? ?? 'event';
    final iconData = _iconForType(typeStr);
    final color = _colorForType(typeStr);
    final timeLabel = _formatTime(notification.createdAt as DateTime);

    return Dismissible(
      key: ValueKey(notification.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: AppThemeTokens.primary500.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.primary500.withValues(alpha: 0.3)),
        ),
        child: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.mark_email_read_rounded, color: AppThemeTokens.primary400, size: 20),
            SizedBox(height: 3),
            Text(
              'Mark read',
              style: TextStyle(
                color: AppThemeTokens.primary400,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
      confirmDismiss: (_) async {
        onDismiss();
        return false;
      },
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          child: Container(
            decoration: BoxDecoration(
              color: isUnread
                  ? color.withValues(alpha: 0.06)
                  : AppThemeTokens.card(context),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
              border: Border.all(
                color: isUnread
                    ? color.withValues(alpha: 0.25)
                    : AppThemeTokens.border(context),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
                    ),
                    child: Icon(iconData, size: 20, color: color),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          notification.summary as String,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: isUnread ? FontWeight.w600 : FontWeight.w400,
                            color: isUnread
                                ? AppThemeTokens.text(context)
                                : AppThemeTokens.textSecondary(context),
                            height: 1.4,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          timeLabel,
                          style: TextStyle(
                            fontSize: 11,
                            color: AppThemeTokens.textMuted(context),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (isUnread)
                    Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.only(top: 3, left: 8),
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
