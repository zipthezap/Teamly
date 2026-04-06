import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/extended_models.dart';
import '../../../shared/widgets/error_display.dart';
import '../data/group_repository_impl.dart';

final _groupInviteAnalyticsProvider =
    FutureProvider.family<InviteAnalyticsModel, String>(
        (ref, groupId) async {
  return ref.watch(groupRepositoryProvider).getGroupInviteAnalytics(groupId);
});

class GroupInviteAnalyticsPage extends ConsumerWidget {
  const GroupInviteAnalyticsPage(
      {super.key, required this.groupId, this.groupName});

  final String groupId;
  final String? groupName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final analyticsAsync =
        ref.watch(_groupInviteAnalyticsProvider(groupId));
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(groupName != null
            ? 'Invite Analytics – $groupName'
            : 'Invite Analytics'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ref.invalidate(_groupInviteAnalyticsProvider(groupId)),
          ),
        ],
      ),
      body: analyticsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () =>
              ref.invalidate(_groupInviteAnalyticsProvider(groupId)),
        ),
        data: (analytics) => RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(_groupInviteAnalyticsProvider(groupId)),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Summary row
              Row(
                children: [
                  Expanded(
                    child: _MetricCard(
                      label: 'Total Invites',
                      value: '${analytics.totalInvites}',
                      icon: Icons.mail_outline,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _MetricCard(
                      label: 'Acceptance Rate',
                      value:
                          '${analytics.acceptanceRate.toStringAsFixed(1)}%',
                      icon: Icons.trending_up,
                      color: Colors.green,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Response breakdown
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Responses',
                          style: theme.textTheme.titleSmall),
                      const SizedBox(height: 16),
                      // Bar chart
                      if (analytics.totalInvites > 0)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: SizedBox(
                            height: 14,
                            child: Row(
                              children: [
                                if (analytics.accepted > 0)
                                  Expanded(
                                    flex: analytics.accepted,
                                    child: Container(color: Colors.green),
                                  ),
                                if (analytics.pending > 0)
                                  Expanded(
                                    flex: analytics.pending,
                                    child: Container(color: Colors.orange),
                                  ),
                                if (analytics.rejected > 0)
                                  Expanded(
                                    flex: analytics.rejected,
                                    child: Container(color: Colors.red),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _LegendItem(
                            color: Colors.green,
                            label: 'Accepted',
                            count: analytics.accepted,
                          ),
                          _LegendItem(
                            color: Colors.orange,
                            label: 'Pending',
                            count: analytics.pending,
                          ),
                          _LegendItem(
                            color: Colors.red,
                            label: 'Rejected',
                            count: analytics.rejected,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // Detail metrics
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

              // Invites per day
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

class _MetricCard extends StatelessWidget {
  const _MetricCard({
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
            Text(label,
                style: theme.textTheme.bodySmall,
                textAlign: TextAlign.center),
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
          mainAxisSize: MainAxisSize.min,
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
