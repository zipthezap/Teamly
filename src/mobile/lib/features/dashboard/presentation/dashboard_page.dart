import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/models/dashboard_model.dart';
import '../../../core/models/notification_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../features/notifications/state/notifications_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../state/dashboard_notifier.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final dashboardAsync = ref.watch(dashboardNotifierProvider);
    final notificationsAsync = ref.watch(notificationsNotifierProvider);

    return MobileShell(
      title: 'Teamly',
      currentIndex: 0,
      child: RefreshIndicator(
        onRefresh: () => ref.read(dashboardNotifierProvider.notifier).reload(),
        child: dashboardAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ErrorDisplay(
            message: extractErrorMessage(e),
            onRetry: () =>
                ref.read(dashboardNotifierProvider.notifier).reload(),
          ),
          data: (dashboard) => _DashboardContent(
            user: authState.user,
            greeting: _greeting(),
            dashboard: dashboard,
            nearbyNotifications: notificationsAsync.valueOrNull ?? const [],
            nearbyLoading: notificationsAsync.isLoading,
          ),
        ),
      ),
    );
  }
}

class _DashboardContent extends StatelessWidget {
  const _DashboardContent({
    required this.user,
    required this.greeting,
    required this.dashboard,
    required this.nearbyNotifications,
    required this.nearbyLoading,
  });

  final dynamic user;
  final String greeting;
  final DashboardModel dashboard;
  final List<NotificationModel> nearbyNotifications;
  final bool nearbyLoading;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final in7d = now.add(const Duration(days: 7));

    final upcomingThisWeek = dashboard.upcomingEvents
        .where((event) =>
            event.startTime.isAfter(now) && event.startTime.isBefore(in7d))
        .toList();

    final visibleUpcoming = upcomingThisWeek.take(2).toList();
    final remainingUpcoming = upcomingThisWeek.length - visibleUpcoming.length;
    final nearbyUpdates = nearbyNotifications
        .where((notification) {
          return notification.type == 'teamup_nearby' ||
              notification.type == 'nearby_created' ||
              notification.type == 'session_created' ||
              notification.type == 'team_invited' ||
              notification.type == 'team_registered' ||
              notification.type == 'tournament_updated' ||
              notification.type == 'tournament_cancelled' ||
              notification.type == 'match_scheduled' ||
              notification.type == 'score_submitted' ||
              notification.type == 'score_disputed' ||
              notification.type == 'payment_reminder' ||
              notification.type == 'announcement';
        })
        .take(4)
        .toList();

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        if (user != null)
          _ContextStrip(
            user: user,
            greeting: greeting,
            unreadNotifications: dashboard.unreadNotifications,
            nextWeekEvents: upcomingThisWeek.length,
            totalSessions: dashboard.stats.totalSessions,
            groupCount: dashboard.stats.groupCount,
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: UiSectionTitle(
            'Upcoming Events',
            trailingLabel: 'See all',
            onTrailingTap: () => context.go('/calendar'),
          ),
        ),
        const SizedBox(height: 10),
        if (upcomingThisWeek.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _NoEventsCard(
              onFindTap: () => context.push('/discover/nearby-sessions'),
            ),
          )
        else
          ...visibleUpcoming.map(
            (event) => Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: _UpcomingCompactTile(event: event),
            ),
          ),
        if (remainingUpcoming > 0)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => context.go('/calendar'),
                icon: const Icon(Icons.calendar_month_outlined, size: 16),
                label: Text('$remainingUpcoming more this week'),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: UiSectionTitle(
            'New Near You',
            trailingLabel: 'All updates',
            onTrailingTap: () => context.push('/notifications'),
          ),
        ),
        const SizedBox(height: 10),
        if (nearbyLoading)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (nearbyUpdates.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _NoNearbyUpdatesCard(
              onExploreTap: () => context.push('/discover'),
            ),
          )
        else
          ...nearbyUpdates.map(
            (notification) => Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: _NearbyUpdateTile(notification: notification),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
          child: UiSectionTitle('Calendar'),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
          child: Wrap(
            spacing: 10,
            runSpacing: 6,
            children: const [
              _CalendarLegendDot(label: 'Sessions', color: Color(0xFF4CAF50)),
              _CalendarLegendDot(label: 'TeamUp', color: Color(0xFF00BCD4)),
              _CalendarLegendDot(
                  label: 'Tournaments', color: Color(0xFFFF9800)),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _CollapsibleCalendarAgenda(
            events: dashboard.upcomingEvents,
            daysToShow: 14,
          ),
        ),
        const SizedBox(height: 32),
      ],
    );
  }
}

String? _normalizeActionRoute(String? rawPath) {
  if (rawPath == null || rawPath.isEmpty || !rawPath.startsWith('/')) {
    return null;
  }

  if (rawPath.startsWith('/events/')) {
    return rawPath.replaceFirst('/events/', '/sessions/');
  }

  final inviteMatch =
      RegExp(r'^/tournaments/.+/invitations/([^/]+)').firstMatch(rawPath);
  if (inviteMatch != null) {
    final token = inviteMatch.group(1);
    if (token != null && token.isNotEmpty) {
      return '/tournaments/invite/$token';
    }
  }

  return rawPath;
}

String? _resolveNotificationRoute(NotificationModel notification) {
  final params = notification.params;
  final inviteToken = params?['inviteToken'] as String?;
  if (inviteToken != null && inviteToken.isNotEmpty) {
    return '/tournaments/invite/$inviteToken';
  }

  final metadataAction = _normalizeActionRoute(
    notification.metadata?['actionUrl'] as String?,
  );
  if (metadataAction != null) {
    return metadataAction;
  }

  if (notification.eventId != null) {
    return '/sessions/${notification.eventId}';
  }
  if (notification.groupId != null) {
    return '/groups/${notification.groupId}';
  }
  if (notification.tournamentId != null) {
    return '/tournaments/${notification.tournamentId}';
  }
  if (notification.teamupId != null) {
    return '/teamup/${notification.teamupId}';
  }

  return null;
}

IconData _iconForNotificationType(NotificationModel notification) {
  switch (notification.notificationType) {
    case 'teamup':
      return Icons.handshake_rounded;
    case 'tournament':
      return Icons.emoji_events_rounded;
    case 'group':
      return Icons.groups_2_rounded;
    default:
      return Icons.sports_soccer_rounded;
  }
}

Color _colorForNotificationType(NotificationModel notification) {
  switch (notification.notificationType) {
    case 'teamup':
      return const Color(0xFF00BCD4);
    case 'tournament':
      return const Color(0xFFFF9800);
    case 'group':
      return AppThemeTokens.primary500;
    default:
      return const Color(0xFF4CAF50);
  }
}

String _timeAgo(DateTime dt) {
  final now = DateTime.now();
  final diff = now.difference(dt.toLocal());
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return DateFormat.yMMMd().format(dt.toLocal());
}

String _labelForNotificationType(NotificationModel notification) {
  switch (notification.notificationType) {
    case 'teamup':
      return 'TeamUp';
    case 'tournament':
      return 'Tournament';
    case 'group':
      return 'Community';
    default:
      return 'Session';
  }
}

class _ContextStrip extends StatelessWidget {
  const _ContextStrip({
    required this.user,
    required this.greeting,
    required this.unreadNotifications,
    required this.nextWeekEvents,
    required this.totalSessions,
    required this.groupCount,
  });

  final dynamic user;
  final String greeting;
  final int unreadNotifications;
  final int nextWeekEvents;
  final int totalSessions;
  final int groupCount;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final city = user.city as String?;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isDark
            ? AppThemeTokens.darkCard.withValues(alpha: 0.9)
            : AppThemeTokens.lightCard.withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color:
              isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
        ),
      ),
      child: Row(
        children: [
          UserAvatar(
            name: user.name as String,
            imageUrl: user.profilePicture as String?,
            radius: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$greeting, ${user.name}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppThemeTokens.text(context),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${unreadNotifications} pending alerts | $nextWeekEvents events this week${city != null ? ' | $city' : ''}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    color: AppThemeTokens.textSecondary(context),
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    const Icon(
                      Icons.local_fire_department_rounded,
                      size: 12,
                      color: AppThemeTokens.primary400,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        '$totalSessions sessions played | $groupCount groups joined',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 10,
                          color: AppThemeTokens.textSecondary(context),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _UpcomingCompactTile extends StatelessWidget {
  const _UpcomingCompactTile({required this.event});

  final DashboardUpcomingEventModel event;

  @override
  Widget build(BuildContext context) {
    final local = event.startTime.toLocal();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        onTap: () => context.push(event.destinationPath),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: isDark
                ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
                : AppThemeTokens.lightCard.withValues(alpha: 0.98),
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(
              color: isDark
                  ? AppThemeTokens.darkBorder
                  : AppThemeTokens.lightBorder,
            ),
          ),
          child: Row(
            children: [
              Icon(_iconForEventType(event.eventType),
                  size: 18, color: AppThemeTokens.primary400),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppThemeTokens.text(context),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${DateFormat('EEE, MMM d').format(local)} at ${DateFormat.jm().format(local)} | ${event.contextName}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        color: AppThemeTokens.textSecondary(context),
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: AppThemeTokens.textMuted(context),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CollapsibleCalendarAgenda extends StatefulWidget {
  const _CollapsibleCalendarAgenda({
    required this.events,
    required this.daysToShow,
  });

  final List<DashboardUpcomingEventModel> events;
  final int daysToShow;

  @override
  State<_CollapsibleCalendarAgenda> createState() =>
      _CollapsibleCalendarAgendaState();
}

class _CollapsibleCalendarAgendaState
    extends State<_CollapsibleCalendarAgenda> {
  DateTime? _expandedDay;
  int _windowStartOffsetDays = 0;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final startDay = today.add(Duration(days: _windowStartOffsetDays));
    final days = List<DateTime>.generate(
      widget.daysToShow,
      (index) => startDay.add(Duration(days: index)),
    );

    final eventsByDay = <DateTime, List<DashboardUpcomingEventModel>>{};
    for (final event in widget.events) {
      if (event.startTime.isBefore(startDay)) continue;
      final day = DateTime(
        event.startTime.year,
        event.startTime.month,
        event.startTime.day,
      );
      eventsByDay
          .putIfAbsent(day, () => <DashboardUpcomingEventModel>[])
          .add(event);
    }

    final expandedEvents = _expandedDay == null
        ? const <DashboardUpcomingEventModel>[]
        : eventsByDay[_expandedDay] ?? const <DashboardUpcomingEventModel>[];

    String rangeLabel;
    if (days.isEmpty) {
      rangeLabel = '';
    } else {
      final first = days.first;
      final last = days.last;
      rangeLabel =
          '${DateFormat('MMM d').format(first)} - ${DateFormat('MMM d').format(last)}';
    }

    final canGoBack = _windowStartOffsetDays > 0;

    return Container(
      decoration: BoxDecoration(
        color: isDark
            ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
            : AppThemeTokens.lightCard.withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color:
              isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
        ),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Back 1 week',
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.chevron_left_rounded, size: 18),
                  onPressed: canGoBack
                      ? () {
                          setState(() {
                            _windowStartOffsetDays =
                                (_windowStartOffsetDays - 7)
                                    .clamp(0, 3650)
                                    .toInt();
                            final nextStart = today
                                .add(Duration(days: _windowStartOffsetDays));
                            final nextEnd = nextStart
                                .add(Duration(days: widget.daysToShow - 1));
                            if (_expandedDay != null &&
                                (_expandedDay!.isBefore(nextStart) ||
                                    _expandedDay!.isAfter(nextEnd))) {
                              _expandedDay = null;
                            }
                          });
                        }
                      : null,
                ),
                Text(
                  rangeLabel,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppThemeTokens.textSecondary(context),
                  ),
                ),
                const Spacer(),
                IconButton(
                  tooltip: 'Forward 1 week',
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.chevron_right_rounded, size: 18),
                  onPressed: () {
                    setState(() {
                      _windowStartOffsetDays += 7;
                      final nextStart =
                          today.add(Duration(days: _windowStartOffsetDays));
                      final nextEnd =
                          nextStart.add(Duration(days: widget.daysToShow - 1));
                      if (_expandedDay != null &&
                          (_expandedDay!.isBefore(nextStart) ||
                              _expandedDay!.isAfter(nextEnd))) {
                        _expandedDay = null;
                      }
                    });
                  },
                ),
                Text(
                  _expandedDay == null
                      ? 'Tap a day'
                      : DateFormat('EEE, MMM d').format(_expandedDay!),
                  style: TextStyle(
                    fontSize: 11,
                    color: AppThemeTokens.textSecondary(context),
                  ),
                ),
              ],
            ),
          ),
          LayoutBuilder(
            builder: (context, constraints) {
              const spacing = 8.0;
              final cellWidth = (constraints.maxWidth - (spacing * 6)) / 7;

              return Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                child: Wrap(
                  spacing: spacing,
                  runSpacing: spacing,
                  children: [
                    for (final day in days)
                      SizedBox(
                        width: cellWidth,
                        child: _CalendarDayDotCell(
                          day: day,
                          events: eventsByDay[day] ?? const [],
                          isExpanded: _expandedDay == day,
                          onTap: () {
                            setState(() {
                              if (_expandedDay == day) {
                                _expandedDay = null;
                              } else {
                                _expandedDay = day;
                              }
                            });
                          },
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeInOut,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: _expandedDay == null
                  ? const SizedBox.shrink()
                  : expandedEvents.isEmpty
                      ? Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'No events on this day',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppThemeTokens.textSecondary(context),
                            ),
                          ),
                        )
                      : Column(
                          children: expandedEvents
                              .map(
                                (event) => Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Material(
                                    color: Colors.transparent,
                                    borderRadius: BorderRadius.circular(
                                        AppThemeTokens.radiusSm),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(
                                          AppThemeTokens.radiusSm),
                                      onTap: () =>
                                          context.push(event.destinationPath),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 7),
                                        decoration: BoxDecoration(
                                          color: _colorForEventType(
                                                  event.eventType)
                                              .withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(
                                              AppThemeTokens.radiusSm),
                                        ),
                                        child: Row(
                                          children: [
                                            Icon(
                                              _iconForEventType(
                                                  event.eventType),
                                              size: 14,
                                              color: _colorForEventType(
                                                  event.eventType),
                                            ),
                                            const SizedBox(width: 7),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    event.title,
                                                    maxLines: 1,
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                      color:
                                                          AppThemeTokens.text(
                                                              context),
                                                    ),
                                                  ),
                                                  Text(
                                                    '${DateFormat.jm().format(event.startTime.toLocal())} | ${event.contextName}',
                                                    maxLines: 1,
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: TextStyle(
                                                      fontSize: 10,
                                                      color: AppThemeTokens
                                                          .textSecondary(
                                                              context),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Icon(
                                              Icons.chevron_right_rounded,
                                              size: 16,
                                              color: AppThemeTokens.textMuted(
                                                  context),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CalendarLegendDot extends StatelessWidget {
  const _CalendarLegendDot({
    required this.label,
    required this.color,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: AppThemeTokens.textSecondary(context),
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _CalendarDayDotCell extends StatelessWidget {
  const _CalendarDayDotCell({
    required this.day,
    required this.events,
    required this.isExpanded,
    required this.onTap,
  });

  final DateTime day;
  final List<DashboardUpcomingEventModel> events;
  final bool isExpanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final isToday = day == today;
    final eventTypes = events.map((event) => event.eventType).toSet().toList();

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          decoration: BoxDecoration(
            color: isExpanded
                ? AppThemeTokens.primary500.withValues(alpha: 0.14)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
            border: Border.all(
              color: isExpanded
                  ? AppThemeTokens.primary500.withValues(alpha: 0.5)
                  : AppThemeTokens.border(context),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                DateFormat('E').format(day).substring(0, 1),
                style: TextStyle(
                  fontSize: 10,
                  color: AppThemeTokens.textSecondary(context),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${day.day}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight:
                      isToday || isExpanded ? FontWeight.w700 : FontWeight.w600,
                  color: AppThemeTokens.text(context),
                ),
              ),
              const SizedBox(height: 4),
              SizedBox(
                height: 7,
                child: events.isEmpty
                    ? null
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (final type in eventTypes.take(3)) ...[
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: _colorForEventType(type),
                                shape: BoxShape.circle,
                              ),
                            ),
                            if (type != eventTypes.take(3).last)
                              const SizedBox(width: 3),
                          ],
                        ],
                      ),
              ),
              const SizedBox(height: 2),
              SizedBox(
                height: 10,
                child: events.isEmpty
                    ? null
                    : Text(
                        '${events.length}',
                        style: TextStyle(
                          fontSize: 9,
                          color: AppThemeTokens.textSecondary(context),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

IconData _iconForEventType(String type) {
  switch (type) {
    case 'teamup':
      return Icons.handshake_rounded;
    case 'tournament':
      return Icons.emoji_events_rounded;
    default:
      return Icons.sports_soccer_rounded;
  }
}

Color _colorForEventType(String type) {
  switch (type) {
    case 'teamup':
      return const Color(0xFF00BCD4);
    case 'tournament':
      return const Color(0xFFFF9800);
    default:
      return const Color(0xFF4CAF50);
  }
}

class _NearbyUpdateTile extends StatelessWidget {
  const _NearbyUpdateTile({required this.notification});

  final NotificationModel notification;

  @override
  Widget build(BuildContext context) {
    final route = _resolveNotificationRoute(notification);
    final color = _colorForNotificationType(notification);
    final icon = _iconForNotificationType(notification);
    final typeLabel = _labelForNotificationType(notification);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: route == null ? null : () => context.push(route),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: isDark
                ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
                : AppThemeTokens.lightCard.withValues(alpha: 0.98),
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(
              color: isDark
                  ? AppThemeTokens.darkBorder
                  : AppThemeTokens.lightBorder,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
                ),
                child: Icon(icon, size: 16, color: color),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.summary,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppThemeTokens.text(context),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$typeLabel | ${_timeAgo(notification.createdAt)}',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppThemeTokens.textSecondary(context),
                      ),
                    ),
                  ],
                ),
              ),
              if (route != null)
                Icon(
                  Icons.chevron_right_rounded,
                  color: AppThemeTokens.textMuted(context),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NoNearbyUpdatesCard extends StatelessWidget {
  const _NoNearbyUpdatesCard({required this.onExploreTap});

  final VoidCallback onExploreTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark
            ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
            : AppThemeTokens.lightCard.withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color:
              isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppThemeTokens.primary500.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
            ),
            child: const Icon(Icons.explore_outlined,
                size: 22, color: AppThemeTokens.primary400),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Nothing new near you yet',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: isDark
                        ? AppThemeTokens.darkText
                        : AppThemeTokens.lightText,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Explore activities and communities in your area.',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark
                        ? AppThemeTokens.darkTextSecondary
                        : AppThemeTokens.lightTextSecondary,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onExploreTap,
            child: const Text('Explore', style: TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _NoEventsCard extends StatelessWidget {
  const _NoEventsCard({required this.onFindTap});

  final VoidCallback onFindTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark
            ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
            : AppThemeTokens.lightCard.withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color:
              isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppThemeTokens.primary500.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
            ),
            child: const Icon(Icons.event_outlined,
                size: 22, color: AppThemeTokens.primary400),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No upcoming events',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: isDark
                        ? AppThemeTokens.darkText
                        : AppThemeTokens.lightText,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Find nearby activities and communities.',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark
                        ? AppThemeTokens.darkTextSecondary
                        : AppThemeTokens.lightTextSecondary,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onFindTap,
            child: const Text('Find', style: TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
