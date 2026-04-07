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
    final theme = Theme.of(context);
    final query = _searchCtrl.text.trim().toLowerCase();

    return MobileShell(
      title: 'Events',
      currentIndex: 2,
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
                  events.where((event) => event.startTime.isAfter(now)).length;
              final hostingCount = events
                  .where((event) => event.creator.id == authState.user?.id)
                  .length;

              if (events.isEmpty) {
                return const UiEmptyState(
                  icon: Icons.event_outlined,
                  message: 'No upcoming events.\nCreate one to get started!',
                );
              }

              return RefreshIndicator(
                onRefresh: () =>
                    ref.read(eventsNotifierProvider.notifier).load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 92),
                  itemCount: filteredEvents.length + 1,
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: _SummaryTile(
                                    label: 'Total',
                                    value: '${events.length}',
                                    icon: Icons.event_outlined,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _SummaryTile(
                                    label: 'Upcoming',
                                    value: '$upcomingCount',
                                    icon: Icons.upcoming_outlined,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _SummaryTile(
                                    label: 'Hosting',
                                    value: '$hostingCount',
                                    icon: Icons.verified_user_outlined,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _searchCtrl,
                              onChanged: (_) => setState(() {}),
                              decoration: InputDecoration(
                                hintText: 'Search events, groups, places',
                                prefixIcon: const Icon(Icons.search),
                                suffixIcon: query.isEmpty
                                    ? null
                                    : IconButton(
                                        icon: const Icon(Icons.close),
                                        onPressed: () {
                                          _searchCtrl.clear();
                                          setState(() {});
                                        },
                                      ),
                              ),
                            ),
                            const SizedBox(height: 10),
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
                                  icon: Icons.search_off_outlined,
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
                    final local = event.startTime.toLocal();
                    final dayNum = DateFormat('d').format(local);
                    final monthAbbr =
                        DateFormat('MMM').format(local).toUpperCase();
                    final timeStr = DateFormat.jm().format(local);
                    final isPast = event.startTime.isBefore(now);
                    final isHosting = event.creator.id == authState.user?.id;
                    final subtitle = [
                      event.group.name,
                      timeStr,
                      if (event.locationName != null) event.locationName!,
                      if (event.city != null) event.city!,
                    ].join(' · ');

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Card(
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () => context.push('/events/${event.id}'),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 12,
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 48,
                                  height: 54,
                                  decoration: BoxDecoration(
                                    color: isPast
                                        ? AppThemeTokens.darkCardHover
                                        : theme.colorScheme.primary
                                            .withAlpha(38),
                                    borderRadius: BorderRadius.circular(
                                      AppThemeTokens.radiusSm,
                                    ),
                                  ),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        monthAbbr,
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                          color: isPast
                                              ? AppThemeTokens.darkTextSecondary
                                              : theme.colorScheme.primary,
                                        ),
                                      ),
                                      Text(
                                        dayNum,
                                        style: TextStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.bold,
                                          height: 1.1,
                                          color: isPast
                                              ? AppThemeTokens.darkTextSecondary
                                              : theme.colorScheme.primary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        event.title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: theme.textTheme.titleSmall
                                            ?.copyWith(
                                          color: isPast
                                              ? AppThemeTokens.darkTextSecondary
                                              : AppThemeTokens.darkText,
                                        ),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        subtitle,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color:
                                              AppThemeTokens.darkTextSecondary,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Wrap(
                                        spacing: 6,
                                        runSpacing: 6,
                                        children: [
                                          if (event.eventType != null)
                                            _MiniTag(label: event.eventType!),
                                          _MiniTag(
                                            label: event.isPublic
                                                ? 'Public'
                                                : 'Private',
                                            icon: event.isPublic
                                                ? Icons.public_outlined
                                                : Icons.lock_outline,
                                          ),
                                          if (isHosting)
                                            const _MiniTag(
                                              label: 'Hosting',
                                              icon:
                                                  Icons.verified_user_outlined,
                                            ),
                                          _MiniTag(
                                            label: event.maxPlayers != null
                                                ? '${event.participantCount}/${event.maxPlayers}'
                                                : '${event.participantCount} joined',
                                            icon: Icons.people_outline,
                                          ),
                                          if (isPast)
                                            const _MiniTag(
                                              label: 'Past',
                                              icon: Icons.history,
                                            ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Icon(
                                  Icons.chevron_right,
                                  color: AppThemeTokens.darkTextSecondary,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              );
            },
          ),
          Positioned(
            bottom: 16,
            right: 16,
            child: FloatingActionButton(
              onPressed: () => context.push('/events/new'),
              tooltip: 'Create event',
              child: const Icon(Icons.add),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return UiCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.primary),
          const SizedBox(height: 10),
          Text(value, style: theme.textTheme.titleLarge),
          Text(
            label,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: AppThemeTokens.darkTextSecondary),
          ),
        ],
      ),
    );
  }
}

class _MiniTag extends StatelessWidget {
  const _MiniTag({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCardHover,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppThemeTokens.darkBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: AppThemeTokens.darkTextSecondary),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppThemeTokens.darkTextSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
