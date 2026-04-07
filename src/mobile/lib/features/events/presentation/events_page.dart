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

class _EventsPageState extends ConsumerState<EventsPage> {
  final _searchCtrl = TextEditingController();
  _EventFilter _filter = _EventFilter.upcoming;

  @override
  void dispose() {
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
      child: Stack(
        children: [
          eventsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => ErrorDisplay(
              message: e.toString(),
              onRetry: () => ref.read(eventsNotifierProvider.notifier).load(),
            ),
            data: (events) {
              final now = DateTime.now();
              final filteredEvents = events.where((event) {
                final matchesFilter = switch (_filter) {
                  _EventFilter.all => true,
                  _EventFilter.upcoming => event.startTime.isAfter(now),
                  _EventFilter.hosting =>
                    event.creator.id == authState.user?.id,
                  _EventFilter.past => !event.startTime.isAfter(now),
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
                        isPast: !event.startTime.isAfter(now),
                        isHosting: event.creator.id == authState.user?.id,
                      ),
                    );
                  },
                ),
              );
            },
          ),
          Positioned(
            bottom: 20,
            right: 20,
            child: FloatingActionButton.extended(
              onPressed: () => context.push('/events/new'),
              icon: const Icon(Icons.add_rounded),
              label: const Text('New Event',
                  style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ),
        ],
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
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.12) : AppThemeTokens.darkCard,
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(
            color: selected ? color.withValues(alpha: 0.4) : AppThemeTokens.darkBorder,
          ),
        ),
        child: Column(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(height: 5),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: color,
                letterSpacing: -0.5,
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                color: AppThemeTokens.darkTextSecondary,
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
    switch ((event.eventType as String?)?.toLowerCase()) {
      case 'match':
      case 'game':
        return AppThemeTokens.primary500;
      case 'training':
      case 'practice':
        return const Color(0xFF4CAF50);
      case 'tournament':
        return const Color(0xFFFF9800);
      case 'social':
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
    final weekday = DateFormat('EEE').format(local);
    final timeStr = DateFormat.jm().format(local);
    final accent = isPast ? AppThemeTokens.darkTextSecondary : _accentColor();

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
              color: AppThemeTokens.darkCard,
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
              border: Border.all(color: AppThemeTokens.darkBorder),
            ),
            child: IntrinsicHeight(
              child: Row(
                children: [
                  // Colored left accent bar
                  Container(
                    width: 4,
                    decoration: BoxDecoration(
                      color: accent,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(AppThemeTokens.radiusMd),
                        bottomLeft: Radius.circular(AppThemeTokens.radiusMd),
                      ),
                    ),
                  ),
                  // Date column
                  Container(
                    width: 52,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          weekday,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: isPast
                                ? AppThemeTokens.darkTextMuted
                                : accent,
                            letterSpacing: 0.5,
                          ),
                        ),
                        Text(
                          dayNum,
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: isPast
                                ? AppThemeTokens.darkTextSecondary
                                : accent,
                            height: 1.1,
                          ),
                        ),
                        Text(
                          monthAbbr,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: isPast
                                ? AppThemeTokens.darkTextMuted
                                : accent,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Divider
                  Container(
                    width: 1,
                    color: AppThemeTokens.darkBorder,
                    margin: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  const SizedBox(width: 12),
                  // Content
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            event.title as String,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                              color: AppThemeTokens.darkText,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            subtitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppThemeTokens.darkTextSecondary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              if (event.eventType != null)
                                _MiniTag(
                                  label: event.eventType as String,
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
                  const Padding(
                    padding: EdgeInsets.only(right: 12),
                    child: Icon(
                      Icons.chevron_right_rounded,
                      color: AppThemeTokens.darkTextSecondary,
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
    final fg = color ?? AppThemeTokens.darkTextSecondary;
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
