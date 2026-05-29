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
    final isParticipant =
        session.participants.any((p) => p.userId == userId && p.status != 'cancelled');
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
        context: tournament.locationName ??
            tournament.city ??
            tournament.sportType,
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
    setState(() => _selectedDay = DateTime(date.year, date.month, date.day));
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
          final selectedDayEvents = events
              .where((event) => _isSameDay(event.startAt, _selectedDay))
              .toList();

          return ListView(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
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
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _CalendarEventCard(
                      event: event,
                      isSelected: _isSameDay(event.startAt, _selectedDay),
                      onSelectDate: () => _focusDateOnCalendar(event.startAt),
                      onOpen: () => context.push(event.destination),
                    ),
                  ),
                ),
              const SizedBox(height: 14),
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
              Container(
                key: _calendarSectionKey,
                decoration: BoxDecoration(
                  color: AppThemeTokens.card(context),
                  borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                  border: Border.all(color: AppThemeTokens.border(context)),
                ),
                child: SizedBox(
                  height: 300,
                  child: CalendarDatePicker(
                    initialDate: _selectedDay,
                    firstDate:
                        DateTime.now().subtract(const Duration(days: 365)),
                    lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
                    currentDate: DateTime.now(),
                    onDateChanged: (date) => setState(() => _selectedDay = date),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Events on ${DateFormat.yMMMMd().format(_selectedDay)}',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppThemeTokens.text(context),
                ),
              ),
              const SizedBox(height: 10),
              if (selectedDayEvents.isEmpty)
                const UiEmptyState(
                  icon: Icons.event_busy_rounded,
                  title: 'No events on this day',
                  message: 'Select another date to see your upcoming events.',
                )
              else
                ...selectedDayEvents.map(
                  (event) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _CalendarEventCard(
                      event: event,
                      isSelected: true,
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
          padding: const EdgeInsets.all(14),
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
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                  border: Border.all(color: accent.withValues(alpha: 0.25)),
                ),
                child: Icon(iconForType(event.type), color: accent, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppThemeTokens.text(context),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${DateFormat('EEE, MMM d • h:mm a').format(event.startAt.toLocal())} • ${event.context}',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppThemeTokens.textSecondary(context),
                      ),
                    ),
                    const SizedBox(height: 6),
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
                  size: 18,
                  color: AppThemeTokens.textSecondary(context),
                ),
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
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
