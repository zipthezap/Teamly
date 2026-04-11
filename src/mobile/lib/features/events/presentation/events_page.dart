import '../../../core/constants/app_constants.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../state/events_notifier.dart';

enum _EventFilter { all, upcoming, hosting, past }

class EventsPage extends ConsumerStatefulWidget {
  const EventsPage({super.key});

  @override
  ConsumerState<EventsPage> createState() => _EventsPageState();
}

class _EventsPageState extends ConsumerState<EventsPage>
    with WidgetsBindingObserver {
  final _searchCtrl = TextEditingController();
  _EventFilter _filter = _EventFilter.upcoming;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(eventsNotifierProvider.notifier).load();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(eventsNotifierProvider.notifier).load();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final eventsAsync = ref.watch(eventsNotifierProvider);
    final authState = ref.watch(authNotifierProvider);
    final query = _searchCtrl.text.trim().toLowerCase();

    return MobileShell(
      title: 'Events',
      currentIndex: 2,
      actions: [
        IconButton(
          icon: const Icon(Icons.ios_share_outlined),
          tooltip: 'Export events',
          onPressed: () {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Export Events'),
                content: const Text(
                  'To export your events as CSV, please use the web app in your browser.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('OK'),
                  ),
                ],
              ),
            );
          },
        ),
      ],
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/events/new'),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Event',
            style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      child: eventsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref.read(eventsNotifierProvider.notifier).load(),
        ),
        data: (events) {
          final now = DateTime.now();
          final filteredEvents = events.where((event) {
            final matchesFilter = switch (_filter) {
              _EventFilter.all => !event.endTime.isBefore(now),
              _EventFilter.upcoming => event.startTime.isAfter(now),
              _EventFilter.hosting =>
                event.creator.id == authState.user?.id,
              _EventFilter.past => !event.endTime.isAfter(now),
            };

            if (!matchesFilter) return false;
            if (query.isEmpty) return true;

            final haystack = [
              event.title,
              event.group.name,
              event.eventType,
              event.locationName,
              event.location,
              event.city,
              event.country,
            ].whereType<String>().join(' ').toLowerCase();

            return haystack.contains(query);
          }).toList();

          final upcomingCount =
              events.where((e) => e.startTime.isAfter(now)).length;
          final hostingCount = events
              .where((e) => e.creator.id == authState.user?.id)
              .length;

          if (events.isEmpty) {
            return const UiEmptyState(
              icon: Icons.event_outlined,
              title: 'No events yet',
              message: 'Create your first event\nto get started!',
            );
          }

          return RefreshIndicator(
            onRefresh: () =>
                ref.read(eventsNotifierProvider.notifier).load(),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
              itemCount: filteredEvents.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      children: [
                        // Stats row
                        Row(
                          children: [
                            Expanded(
                              child: _EventStatPill(
                                label: 'Total',
                                value: '${events.length}',
                                icon: Icons.event_rounded,
                                color: AppThemeTokens.primary500,
                                onTap: () => setState(
                                    () => _filter = _EventFilter.all),
                                selected: _filter == _EventFilter.all,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _EventStatPill(
                                label: 'Upcoming',
                                value: '$upcomingCount',
                                icon: Icons.upcoming_rounded,
                                color: const Color(0xFF00BCD4),
                                onTap: () => setState(
                                    () => _filter = _EventFilter.upcoming),
                                selected: _filter == _EventFilter.upcoming,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _EventStatPill(
                                label: 'Hosting',
                                value: '$hostingCount',
                                icon: Icons.verified_user_rounded,
                                color: const Color(0xFF7C4DFF),
                                onTap: () => setState(
                                    () => _filter = _EventFilter.hosting),
                                selected: _filter == _EventFilter.hosting,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        // Search field
                        TextField(
                          controller: _searchCtrl,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            hintText: 'Search events, groups, places…',
                            prefixIcon: const Icon(Icons.search_rounded),
                            suffixIcon: query.isEmpty
                                ? null
                                : IconButton(
                                    icon: const Icon(Icons.close_rounded),
                                    onPressed: () {
                                      _searchCtrl.clear();
                                      setState(() {});
                                    },
                                  ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        // Filter chips
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: _EventFilter.values.map((filter) {
                              final label = switch (filter) {
                                _EventFilter.all => 'All',
                                _EventFilter.upcoming => 'Upcoming',
                                _EventFilter.hosting => 'Hosting',
                                _EventFilter.past => 'Past',
                              };
                              return Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                  label: Text(label),
                                  selected: _filter == filter,
                                  onSelected: (_) =>
                                      setState(() => _filter = filter),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                        if (filteredEvents.isEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 24),
                            child: UiEmptyState(
                              icon: Icons.search_off_rounded,
                              message:
                                  'No events match the current filters.',
                              action: () {
                                _searchCtrl.clear();
                                setState(() => _filter = _EventFilter.all);
                              },
                              actionLabel: 'Reset filters',
                            ),
                          ),
                      ],
                    ),
                  );
                }

                final event = filteredEvents[index - 1];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _EventListCard(
                    event: event,
                    isPast: !event.endTime.isAfter(now),
                    isHosting: event.creator.id == authState.user?.id,
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

// ── Event stat pill ───────────────────────────────────────────────────────────

class _EventStatPill extends StatelessWidget {
  const _EventStatPill({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.onTap,
    required this.selected,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
        decoration: BoxDecoration(
          color:
              selected ? color.withValues(alpha: 0.12) : Colors.transparent,
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
          border: Border.all(
            color: selected
                ? color.withValues(alpha: 0.35)
                : AppThemeTokens.border(context),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: AppThemeTokens.textSecondary(context),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Event list card ───────────────────────────────────────────────────────────

class _EventListCard extends StatelessWidget {
  const _EventListCard({
    required this.event,
    required this.isPast,
    required this.isHosting,
  });

  final dynamic event;
  final bool isPast;
  final bool isHosting;

  Color _accentColor() {
    switch (event.eventType as String?) {
      case 'football':
      case 'americanFootball':
      case 'rugby':
      case 'handball':
      case 'fieldHockey':
        return AppThemeTokens.primary500;
      case 'basketball':
      case 'volleyball':
        return const Color(0xFFFF9800);
      case 'tennis':
      case 'baseball':
      case 'cricket':
        return const Color(0xFF4CAF50);
      case 'running':
      case 'cycling':
      case 'swimming':
        return const Color(0xFF00BCD4);
      case 'iceHockey':
        return const Color(0xFF7C4DFF);
      default:
        return AppThemeTokens.primary500;
    }
  }

  @override
  Widget build(BuildContext context) {
    final local = (event.startTime as DateTime).toLocal();
    final dayNum = DateFormat('d').format(local);
    final monthAbbr = DateFormat('MMM').format(local).toUpperCase();
    final timeStr = DateFormat.jm().format(local);
    final accent = isPast ? AppThemeTokens.textSecondary(context) : _accentColor();

    final subtitle = [
      event.group.name as String,
      timeStr,
      if ((event.locationName as String?) != null) event.locationName as String,
      if ((event.city as String?) != null) event.city as String,
    ].join(' · ');

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: () => context.push('/events/${event.id}'),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: Opacity(
          opacity: isPast ? 0.65 : 1.0,
          child: Container(
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: AppThemeTokens.border(context).withValues(alpha: 0.8),
                ),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  const SizedBox(width: 8),
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.12),
                      borderRadius:
                          BorderRadius.circular(AppThemeTokens.radiusSm),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          monthAbbr,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: accent,
                            letterSpacing: 0.4,
                          ),
                        ),
                        Text(
                          dayNum,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: accent,
                            height: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Content
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            event.title as String,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                              color: AppThemeTokens.text(context),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            subtitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: isPast
                                  ? AppThemeTokens.textMuted(context)
                                  : AppThemeTokens.textSecondary(context),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              if (event.eventType != null)
                                _MiniTag(
                                  label: sportTypeLabel(event.eventType as String?),
                                  color: accent,
                                ),
                              _MiniTag(
                                label: (event.isPublic as bool? ?? true)
                                    ? 'Public'
                                    : 'Private',
                                icon: (event.isPublic as bool? ?? true)
                                    ? Icons.public_rounded
                                    : Icons.lock_rounded,
                              ),
                              if (isHosting)
                                const _MiniTag(
                                  label: 'Hosting',
                                  icon: Icons.verified_user_rounded,
                                ),
                              if (event.maxPlayers != null)
                                _MiniTag(
                                  label:
                                      '${event.participantCount}/${event.maxPlayers}',
                                  icon: Icons.people_outline,
                                ),
                              if (isPast)
                                const _MiniTag(label: 'Past', icon: Icons.history_rounded),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Icon(
                      Icons.chevron_right_rounded,
                      color: AppThemeTokens.textSecondary(context),
                      size: 20,
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

// ── Mini tag chip ─────────────────────────────────────────────────────────────

class _MiniTag extends StatelessWidget {
  const _MiniTag({required this.label, this.icon, this.color});

  final String label;
  final IconData? icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final fg = color ?? AppThemeTokens.textSecondary(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: fg.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: fg),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: fg,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
