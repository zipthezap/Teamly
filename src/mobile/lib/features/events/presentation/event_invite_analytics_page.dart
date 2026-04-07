import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/widgets/error_display.dart';
import '../state/events_notifier.dart';

class EventInviteAnalyticsPage extends ConsumerWidget {
  const EventInviteAnalyticsPage(
      {super.key, required this.eventId, this.eventTitle});

  final String eventId;
  final String? eventTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final analyticsAsync = ref.watch(eventInviteAnalyticsProvider(eventId));
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(eventTitle != null
            ? 'Invite Analytics – $eventTitle'
            : 'Invite Analytics'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ref.invalidate(eventInviteAnalyticsProvider(eventId)),
          ),
        ],
      ),
      body: analyticsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () =>
              ref.invalidate(eventInviteAnalyticsProvider(eventId)),
        ),
        data: (analytics) => RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(eventInviteAnalyticsProvider(eventId)),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Overview row
              Row(
                children: [
                  Expanded(
                    child: _AnalyticCard(
                      label: 'Total Invites',
                      value: '${analytics.totalInvites}',
                      icon: Icons.mail_outline,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _AnalyticCard(
                      label: 'Acceptance Rate',
                      value:
                          '${analytics.acceptanceRate.toStringAsFixed(1)}%',
                      icon: Icons.trending_up,
                      color: AppThemeTokens.success,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Breakdown
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Response Breakdown',
                          style: theme.textTheme.titleSmall),
                      const SizedBox(height: 16),
                      _BreakdownBar(
                        accepted: analytics.accepted,
                        rejected: analytics.rejected,
                        pending: analytics.pending,
                        total: analytics.totalInvites,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _LegendItem(
                              color: AppThemeTokens.success,
                              label: 'Accepted',
                              count: analytics.accepted),
                          _LegendItem(
                              color: AppThemeTokens.error,
                              label: 'Rejected',
                              count: analytics.rejected),
                          _LegendItem(
                              color: AppThemeTokens.warning,
                              label: 'Pending',
                              count: analytics.pending),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Extra metrics
              Card(
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.people_outline),
                      title: const Text('Unique Recipients'),
                      trailing: Text(
                        '${analytics.uniqueRecipientsCount}',
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.timer_outlined),
                      title: const Text('Avg Time to Accept'),
                      trailing: Text(
                        _formatDuration(analytics.avgTimeToAcceptMs),
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),

              // Top domains
              if (analytics.topInvitedDomains.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('Top Email Domains',
                    style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: analytics.topInvitedDomains
                        .asMap()
                        .entries
                        .map(
                          (e) => ListTile(
                            leading: CircleAvatar(
                              radius: 14,
                              child: Text('${e.key + 1}',
                                  style: const TextStyle(fontSize: 12)),
                            ),
                            title: Text(e.value),
                          ),
                        )
                        .toList(),
                  ),
                ),
              ],

              // Invites sent per day
              if (analytics.invitesSentPerDay.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('Invites Sent Per Day',
                    style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: analytics.invitesSentPerDay.map((entry) {
                      return ListTile(
                        leading: const Icon(Icons.calendar_today_outlined,
                            size: 18),
                        title: Text(entry.date),
                        trailing: Text(
                          '${entry.count}',
                          style: theme.textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.bold),
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

  String _formatDuration(double ms) {
    if (ms <= 0) return 'N/A';
    final hours = ms / (1000 * 60 * 60);
    if (hours < 1) return '${(ms / 60000).toStringAsFixed(0)} min';
    if (hours < 24) return '${hours.toStringAsFixed(1)} hrs';
    return '${(hours / 24).toStringAsFixed(1)} days';
  }
}

class _AnalyticCard extends StatelessWidget {
  const _AnalyticCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 8),
            Text(value,
                style: theme.textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 4),
            Text(label, style: theme.textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _BreakdownBar extends StatelessWidget {
  const _BreakdownBar({
    required this.accepted,
    required this.rejected,
    required this.pending,
    required this.total,
  });

  final int accepted;
  final int rejected;
  final int pending;
  final int total;

  @override
  Widget build(BuildContext context) {
    if (total == 0) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: Container(
          height: 12,
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
        ),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: SizedBox(
        height: 12,
        child: Row(
          children: [
            if (accepted > 0)
              Expanded(
                flex: accepted,
                child: Container(color: AppThemeTokens.success),
              ),
            if (pending > 0)
              Expanded(
                flex: pending,
                child: Container(color: AppThemeTokens.warning),
              ),
            if (rejected > 0)
              Expanded(
                flex: rejected,
                child: Container(color: AppThemeTokens.error),
              ),
          ],
        ),
      ),
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({
    required this.color,
    required this.label,
    required this.count,
  });

  final Color color;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration:
                  BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 4),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
        Text('$count',
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }
}
