import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/error_display.dart';
import '../state/events_notifier.dart';

class EventStatisticsPage extends ConsumerWidget {
  const EventStatisticsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(eventStatisticsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Event Statistics'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(eventStatisticsProvider),
          ),
        ],
      ),
      body: statsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref.invalidate(eventStatisticsProvider),
        ),
        data: (stats) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(eventStatisticsProvider),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Participation overview
              Text('Participation', style: theme.textTheme.titleMedium),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.event_available,
                      label: 'Events Joined',
                      value: '${stats.totalEventsJoined}',
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.add_circle_outline,
                      label: 'Events Created',
                      value: '${stats.totalEventsCreated}',
                      color: Colors.green,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.upcoming_outlined,
                      label: 'Upcoming',
                      value: '${stats.upcomingEvents}',
                      color: Colors.blue,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.history,
                      label: 'Past',
                      value: '${stats.pastEvents}',
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Created events stats
              if (stats.totalEventsCreated > 0) ...[
                Text('Events You Organized',
                    style: theme.textTheme.titleMedium),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _SmallStat(
                              label: 'Total Events',
                              value:
                                  '${stats.createdEventsStats.total}'),
                          _SmallStat(
                              label: 'Total Players',
                              value:
                                  '${stats.createdEventsStats.totalParticipants}'),
                          _SmallStat(
                              label: 'Avg Players',
                              value: stats.createdEventsStats
                                  .avgParticipantsPerEvent
                                  .toStringAsFixed(1)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],

              // Sport type breakdown
              if (stats.eventTypeBreakdown.isNotEmpty) ...[
                const SizedBox(height: 24),
                Text('By Sport Type', style: theme.textTheme.titleMedium),
                const SizedBox(height: 12),
                Card(
                  child: Column(
                    children: stats.eventTypeBreakdown.entries
                        .toList()
                        .where((e) => e.value > 0)
                        .map((entry) {
                      final total = stats.totalEventsJoined > 0
                          ? stats.totalEventsJoined
                          : 1;
                      final pct = entry.value / total;
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              children: [
                                Text(entry.key,
                                    style: theme.textTheme.bodyMedium),
                                Text('${entry.value}',
                                    style: theme.textTheme.bodyMedium
                                        ?.copyWith(
                                            fontWeight: FontWeight.bold)),
                              ],
                            ),
                            const SizedBox(height: 6),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: pct.clamp(0.0, 1.0),
                                minHeight: 6,
                                backgroundColor: theme.colorScheme
                                    .surfaceContainerHighest,
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(
              value,
              style: theme.textTheme.headlineMedium
                  ?.copyWith(fontWeight: FontWeight.bold, color: color),
            ),
            const SizedBox(height: 4),
            Text(label,
                style: theme.textTheme.bodySmall,
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _SmallStat extends StatelessWidget {
  const _SmallStat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: Theme.of(context)
              .textTheme
              .titleLarge
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
