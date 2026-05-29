import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/models/dashboard_model.dart';
import '../../../core/models/league_model.dart';
import '../../../core/models/session_model.dart';
import '../../../core/models/teamup_model.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../auth/state/auth_notifier.dart';
import '../../leagues/state/leagues_notifier.dart';
import '../../sessions/state/sessions_notifier.dart';
import '../../teamup/state/teamup_notifier.dart';
import '../../tournaments/state/tournaments_notifier.dart';
import '../state/dashboard_notifier.dart';

enum _AwareEventType {
  session,
  teamup,
  tournament,
  league,
}

class _AwareCalendarEvent {
  const _AwareCalendarEvent({
    required this.id,
    required this.type,
    required this.title,
    required this.startAt,
    required this.context,
    required this.destination,
    required this.role,
  });

  final String id;
  final _AwareEventType type;
  final String title;
  final DateTime startAt;
  final String context;
  final String destination;
  final String role;

  String get dedupeKey => '${type.name}:$id';
}

final awareCalendarEventsProvider =
    FutureProvider<List<_AwareCalendarEvent>>((ref) async {
  final authState = ref.watch(authNotifierProvider);
  final userId = authState.user?.id;
  if (userId == null) return const [];

  final dashboard = await ref.watch(dashboardNotifierProvider.future);
  final sessions = await ref.watch(sessionsNotifierProvider.future);
  final tournaments = await ref.watch(tournamentsNotifierProvider.future);
  final leagues = await ref.watch(leaguesNotifierProvider.future);
  final myTeamUpRequests = await ref.watch(myTeamUpRequestsProvider.future);
  final myTeamUpApplications =
      await ref.watch(myTeamUpApplicationsProvider.future);

  final now = DateTime.now();
  final eventsByKey = <String, _AwareCalendarEvent>{};

  void addEvent(_AwareCalendarEvent event) {
    eventsByKey[event.dedupeKey] = event;
  }

  for (final item in dashboard.upcomingEvents) {
    final type = switch (item.eventType) {
      'teamup' => _AwareEventType.teamup,
      'tournament' => _AwareEventType.tournament,
      _ => _AwareEventType.session,
    };

    if (!item.startTime.isBefore(now)) {
      addEvent(
        _AwareCalendarEvent(
          id: item.id,
          type: type,
          title: item.title,
          startAt: item.startTime,
          context: item.contextName,
          destination: item.destinationPath,
          role: 'Aware',
        ),
      );
    }
  }

  for (final session in sessions) {
    if (session.startTime.isBefore(now)) continue;

    final isHost = session.creator.id == userId;
    final isParticipant = session.participants
        .any((p) => p.userId == userId && p.status != 'cancelled');
    if (!isHost && !isParticipant) continue;

    addEvent(
      _AwareCalendarEvent(
        id: session.id,
        type: _AwareEventType.session,
        title: session.title,
        startAt: session.startTime,
        context: session.group.name,
        destination: '/sessions/${session.id}',
        role: isHost ? 'Hosting' : 'Participating',
      ),
    );
  }

  for (final request in myTeamUpRequests) {
    final date = request.dateTime;
    if (date == null || date.isBefore(now)) continue;
    if (request.status == 'cancelled' || request.status == 'expired') continue;

    addEvent(
      _AwareCalendarEvent(
        id: request.id,
        type: _AwareEventType.teamup,
        title: request.title,
        startAt: date,
        context: request.location ?? request.city ?? 'TeamUp',
        destination: '/teamup/${request.id}',
        role: 'Hosting',
      ),
    );
  }

  for (final application in myTeamUpApplications) {
    final date = application.requestDateTime;
    if (date == null || date.isBefore(now)) continue;
    if (application.requestStatus == 'cancelled' ||
        application.requestStatus == 'expired') {
      continue;
    }
    if (!(application.status == 'pending' ||
        application.status == 'accepted' ||
        application.status == 'waitlisted')) {
      continue;
    }

    addEvent(
      _AwareCalendarEvent(
        id: application.requestId,
        type: _AwareEventType.teamup,
        title: application.requestTitle,
        startAt: date,
        context: application.requestLocation ??
            application.requestCity ??
            application.requestCreatorName ??
            'TeamUp',
        destination: '/teamup/${application.requestId}',
        role: 'Participating',
      ),
    );
  }

  for (final tournament in tournaments) {
    final date = tournament.startDate;
    if (date == null || date.isBefore(now)) continue;

    final isHost = tournament.creatorId == userId ||
        tournament.admins.any((a) => a.userId == userId);

    final isParticipantFromMyTeam =
        tournament.myTeam?.captainUserId == userId ||
            (tournament.myTeam?.players
                    .any((p) => (p['userId'] as String?) == userId) ??
                false);

    final isParticipantFromTeams = tournament.teams.any(
      (team) =>
          team.captainUserId == userId ||
          team.players.any((p) => (p['userId'] as String?) == userId),
    );

    if (!isHost && !isParticipantFromMyTeam && !isParticipantFromTeams) {
      continue;
    }

    addEvent(
      _AwareCalendarEvent(
        id: tournament.id,
        type: _AwareEventType.tournament,
        title: tournament.name,
        startAt: date,
        context:
            tournament.locationName ?? tournament.city ?? tournament.sportType,
        destination: '/tournaments/${tournament.id}',
        role: isHost ? 'Hosting' : 'Participating',
      ),
    );
  }

  for (final league in leagues) {
    final date = league.startDate;
    if (date == null || date.isBefore(now)) continue;

    final isHost = league.owner?.id == userId;
    final isParticipant = league.teams.any(
      (team) =>
          team.captainUserId == userId ||
          team.players.any((player) => player.userId == userId),
    );

    if (!isHost && !isParticipant) continue;

    addEvent(
      _AwareCalendarEvent(
        id: league.id,
        type: _AwareEventType.league,
        title: league.name,
        startAt: date,
        context: league.location ?? league.sport,
        destination: '/leagues/${league.id}',
        role: isHost ? 'Hosting' : 'Participating',
      ),
    );
  }

  final events = eventsByKey.values.toList()
    ..sort((a, b) {
      final byStart = a.startAt.compareTo(b.startAt);
      if (byStart != 0) return byStart;
      return a.title.compareTo(b.title);
    });

  return events;
});

class AwareEventsCalendarPage extends ConsumerStatefulWidget {
  const AwareEventsCalendarPage({
    super.key,
    this.asDashboard = false,
  });

  final bool asDashboard;

  @override
  ConsumerState<AwareEventsCalendarPage> createState() =>
      _AwareEventsCalendarPageState();
}

class _AwareEventsCalendarPageState
    extends ConsumerState<AwareEventsCalendarPage> {
  DateTime _selectedDay = DateTime.now();
  DateTime _visibleMonth = DateTime(DateTime.now().year, DateTime.now().month);
  final _scrollController = ScrollController();
  final _calendarSectionKey = GlobalKey();

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _focusDateOnCalendar(DateTime date) {
    setState(() {
      _selectedDay = DateTime(date.year, date.month, date.day);
      _visibleMonth = DateTime(date.year, date.month);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final calendarContext = _calendarSectionKey.currentContext;
      if (calendarContext != null) {
        Scrollable.ensureVisible(
          calendarContext,
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutCubic,
          alignment: 0.05,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final calendarAsync = ref.watch(awareCalendarEventsProvider);
    final asDashboard = widget.asDashboard;

    return MobileShell(
      title: asDashboard ? 'Teamly' : 'My Calendar',
      currentIndex: asDashboard ? 0 : -1,
      leading: asDashboard
          ? null
          : IconButton(
              icon: const Icon(Icons.arrow_back_rounded),
              tooltip: 'Back',
              onPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/dashboard');
                }
              },
            ),
      child: calendarAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorDisplay(
          message: error.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(awareCalendarEventsProvider),
        ),
        data: (events) {
          return ListView(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: const [
                  _LegendChip(type: _AwareEventType.session, label: 'Sessions'),
                  _LegendChip(type: _AwareEventType.teamup, label: 'TeamUp'),
                  _LegendChip(
                      type: _AwareEventType.tournament, label: 'Tournaments'),
                  _LegendChip(type: _AwareEventType.league, label: 'Leagues'),
                ],
              ),
              const SizedBox(height: 18),
              _MonthlyDotCalendar(
                key: _calendarSectionKey,
                events: events,
                visibleMonth: _visibleMonth,
                selectedDay: _selectedDay,
                onPreviousMonth: () {
                  setState(() {
                    _visibleMonth =
                        DateTime(_visibleMonth.year, _visibleMonth.month - 1);
                    if (_selectedDay.year != _visibleMonth.year ||
                        _selectedDay.month != _visibleMonth.month) {
                      _selectedDay =
                          DateTime(_visibleMonth.year, _visibleMonth.month, 1);
                    }
                  });
                },
                onNextMonth: () {
                  setState(() {
                    _visibleMonth =
                        DateTime(_visibleMonth.year, _visibleMonth.month + 1);
                    if (_selectedDay.year != _visibleMonth.year ||
                        _selectedDay.month != _visibleMonth.month) {
                      _selectedDay =
                          DateTime(_visibleMonth.year, _visibleMonth.month, 1);
                    }
                  });
                },
                onDaySelected: (day) => setState(() => _selectedDay = day),
                onOpenEvent: (event) => context.push(event.destination),
              ),
              const SizedBox(height: 16),
              Text(
                'All Upcoming Events',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppThemeTokens.text(context),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Tap an event to highlight its date in the calendar.',
                style: TextStyle(
                  fontSize: 12,
                  color: AppThemeTokens.textSecondary(context),
                ),
              ),
              const SizedBox(height: 10),
              if (events.isEmpty)
                const UiEmptyState(
                  icon: Icons.event_busy_rounded,
                  title: 'No upcoming events',
                  message: 'You have no upcoming events at the moment.',
                )
              else
                ...events.map(
                  (event) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _CalendarEventCard(
                      event: event,
                      isSelected: _isSameDay(event.startAt, _selectedDay),
                      onSelectDate: () => _focusDateOnCalendar(event.startAt),
                      onOpen: () => context.push(event.destination),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _LegendChip extends StatelessWidget {
  const _LegendChip({required this.type, required this.label});

  final _AwareEventType type;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = _CalendarEventCard.colorForType(type);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppThemeTokens.text(context),
            ),
          ),
        ],
      ),
    );
  }
}

class _MonthlyDotCalendar extends StatelessWidget {
  const _MonthlyDotCalendar({
    super.key,
    required this.events,
    required this.visibleMonth,
    required this.selectedDay,
    required this.onPreviousMonth,
    required this.onNextMonth,
    required this.onDaySelected,
    required this.onOpenEvent,
  });

  final List<_AwareCalendarEvent> events;
  final DateTime visibleMonth;
  final DateTime selectedDay;
  final VoidCallback onPreviousMonth;
  final VoidCallback onNextMonth;
  final ValueChanged<DateTime> onDaySelected;
  final ValueChanged<_AwareCalendarEvent> onOpenEvent;

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final monthStart = DateTime(visibleMonth.year, visibleMonth.month, 1);
    final daysInMonth =
        DateUtils.getDaysInMonth(monthStart.year, monthStart.month);
    final leadingSlots = monthStart.weekday - 1;

    final days = List<DateTime>.generate(
      daysInMonth,
      (index) => DateTime(monthStart.year, monthStart.month, index + 1),
    );

    final slots = <DateTime?>[
      ...List<DateTime?>.filled(leadingSlots, null),
      ...days,
    ];

    final eventsByDay = <DateTime, List<_AwareCalendarEvent>>{};
    for (final event in events) {
      final day =
          DateTime(event.startAt.year, event.startAt.month, event.startAt.day);
      eventsByDay.putIfAbsent(day, () => <_AwareCalendarEvent>[]).add(event);
    }

    final selectedEvents = eventsByDay[
            DateTime(selectedDay.year, selectedDay.month, selectedDay.day)] ??
        const <_AwareCalendarEvent>[];

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
                  tooltip: 'Previous month',
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.chevron_left_rounded, size: 18),
                  onPressed: onPreviousMonth,
                ),
                Text(
                  DateFormat.yMMMM().format(monthStart),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppThemeTokens.textSecondary(context),
                  ),
                ),
                const Spacer(),
                IconButton(
                  tooltip: 'Next month',
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.chevron_right_rounded, size: 18),
                  onPressed: onNextMonth,
                ),
                Text(
                  DateFormat('EEE, MMM d').format(selectedDay),
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
                    for (final day in slots)
                      SizedBox(
                        width: cellWidth,
                        child: day == null
                            ? const SizedBox(height: 66)
                            : _AwareCalendarDayDotCell(
                                day: day,
                                events: eventsByDay[day] ?? const [],
                                isSelected: _isSameDay(day, selectedDay),
                                onTap: () => onDaySelected(day),
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
              child: selectedEvents.isEmpty
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
                      children: selectedEvents
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
                                  onTap: () => onOpenEvent(event),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 7),
                                    decoration: BoxDecoration(
                                      color: _CalendarEventCard.colorForType(
                                              event.type)
                                          .withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(
                                          AppThemeTokens.radiusSm),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          _CalendarEventCard.iconForType(
                                              event.type),
                                          size: 14,
                                          color:
                                              _CalendarEventCard.colorForType(
                                                  event.type),
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
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w600,
                                                  color: AppThemeTokens.text(
                                                      context),
                                                ),
                                              ),
                                              Text(
                                                '${DateFormat.jm().format(event.startAt.toLocal())} | ${event.context}',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  color: AppThemeTokens
                                                      .textSecondary(context),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Icon(
                                          Icons.chevron_right_rounded,
                                          size: 16,
                                          color:
                                              AppThemeTokens.textMuted(context),
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

class _AwareCalendarDayDotCell extends StatelessWidget {
  const _AwareCalendarDayDotCell({
    required this.day,
    required this.events,
    required this.isSelected,
    required this.onTap,
  });

  final DateTime day;
  final List<_AwareCalendarEvent> events;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final isToday = day == today;
    final eventTypes = events.map((event) => event.type).toSet().toList();

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected
                ? AppThemeTokens.primary500.withValues(alpha: 0.14)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
            border: Border.all(
              color: isSelected
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
                      isToday || isSelected ? FontWeight.w700 : FontWeight.w600,
                  color: AppThemeTokens.text(context),
                ),
              ),
              const SizedBox(height: 4),
              if (events.isEmpty)
                const SizedBox(height: 7)
              else
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 3,
                  runSpacing: 2,
                  children: [
                    for (final type in eventTypes.take(3))
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: _CalendarEventCard.colorForType(type),
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
              if (events.isNotEmpty)
                Text(
                  '${events.length}',
                  style: TextStyle(
                    fontSize: 9,
                    color: AppThemeTokens.textSecondary(context),
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CalendarEventCard extends StatelessWidget {
  const _CalendarEventCard({
    required this.event,
    required this.onSelectDate,
    required this.onOpen,
    this.isSelected = false,
  });

  final _AwareCalendarEvent event;
  final VoidCallback onSelectDate;
  final VoidCallback onOpen;
  final bool isSelected;

  static Color colorForType(_AwareEventType type) {
    switch (type) {
      case _AwareEventType.session:
        return const Color(0xFF7C4DFF);
      case _AwareEventType.teamup:
        return const Color(0xFF5E35B1);
      case _AwareEventType.tournament:
        return const Color(0xFFFF9800);
      case _AwareEventType.league:
        return const Color(0xFF8B5CF6);
    }
  }

  static IconData iconForType(_AwareEventType type) {
    switch (type) {
      case _AwareEventType.session:
        return Icons.event_rounded;
      case _AwareEventType.teamup:
        return Icons.handshake_rounded;
      case _AwareEventType.tournament:
        return Icons.emoji_events_rounded;
      case _AwareEventType.league:
        return Icons.military_tech_rounded;
    }
  }

  static String labelForType(_AwareEventType type) {
    switch (type) {
      case _AwareEventType.session:
        return 'Session';
      case _AwareEventType.teamup:
        return 'TeamUp';
      case _AwareEventType.tournament:
        return 'Tournament';
      case _AwareEventType.league:
        return 'League';
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = colorForType(event.type);

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        onTap: onSelectDate,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppThemeTokens.card(context),
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(
              color: isSelected ? accent : AppThemeTokens.border(context),
              width: isSelected ? 1.3 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                  border: Border.all(color: accent.withValues(alpha: 0.25)),
                ),
                child: Icon(iconForType(event.type), color: accent, size: 18),
              ),
              const SizedBox(width: 10),
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
                        fontWeight: FontWeight.w700,
                        color: AppThemeTokens.text(context),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${DateFormat('EEE, MMM d • h:mm a').format(event.startAt.toLocal())} • ${event.context}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        color: AppThemeTokens.textSecondary(context),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _Badge(
                          text: labelForType(event.type),
                          color: accent,
                        ),
                        const SizedBox(width: 6),
                        _Badge(
                          text: event.role,
                          color: AppThemeTokens.primary500,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Open event',
                onPressed: onOpen,
                icon: Icon(
                  Icons.open_in_new_rounded,
                  size: 16,
                  color: AppThemeTokens.textSecondary(context),
                ),
                visualDensity: VisualDensity.compact,
                constraints:
                    const BoxConstraints.tightFor(width: 32, height: 32),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
