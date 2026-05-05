import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../state/tournaments_notifier.dart';

class MatchSchedulePage extends ConsumerWidget {
  const MatchSchedulePage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(tournamentDetailProvider(tournamentId));

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Match Schedule'),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(message: e.toString()),
        data: (tournament) => _ScheduleView(tournament: tournament),
      ),
    );
  }
}

class _ScheduleView extends StatelessWidget {
  const _ScheduleView({required this.tournament});

  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final matches = List<Map<String, dynamic>>.from(
      tournament.matches.whereType<Map<String, dynamic>>(),
    );

    if (matches.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.calendar_today_outlined,
                size: 64, color: AppThemeTokens.textMuted(context)),
            const SizedBox(height: 16),
            Text(
              'No matches scheduled yet',
              style: TextStyle(color: AppThemeTokens.textSecondary(context)),
            ),
          ],
        ),
      );
    }

    // Sort by scheduled time, nulls last
    matches.sort((a, b) {
      final aTime = a['scheduledAt'] as String?;
      final bTime = b['scheduledAt'] as String?;
      if (aTime == null && bTime == null) return 0;
      if (aTime == null) return 1;
      if (bTime == null) return -1;
      return aTime.compareTo(bTime);
    });

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: matches.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) => _MatchTile(match: matches[i]),
    );
  }
}

class _MatchTile extends StatelessWidget {
  const _MatchTile({required this.match});

  final Map<String, dynamic> match;

  String _statusLabel(String? status) {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'Live';
      case 'scheduled':
        return 'Scheduled';
      default:
        return 'Pending';
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'completed':
        return AppThemeTokens.success;
      case 'in_progress':
        return AppThemeTokens.error;
      case 'scheduled':
        return AppThemeTokens.info;
      default:
        return AppThemeTokens.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final teamA = match['teamA'] as Map<String, dynamic>?;
    final teamB = match['teamB'] as Map<String, dynamic>?;
    final scoreA = match['scoreA'];
    final scoreB = match['scoreB'];
    final status = match['status'] as String?;
    final scheduledAt = match['scheduledAt'] as String?;
    final venue = match['venue'] as String?;
    final isCompleted = status == 'completed';

    final scheduledDate = scheduledAt != null ? DateTime.tryParse(scheduledAt) : null;
    final fmt = DateFormat('MMM d, h:mm a');

    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.cardElevated(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: _statusColor(status).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  _statusLabel(status),
                  style: TextStyle(
                    color: _statusColor(status),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (scheduledDate != null) ...[
                const SizedBox(width: 8),
                Text(
                  fmt.format(scheduledDate.toLocal()),
                  style: TextStyle(
                    fontSize: 12,
                    color: AppThemeTokens.textMuted(context),
                  ),
                ),
              ],
              const Spacer(),
              if (match['round'] != null)
                Text(
                  'Rd ${match['round']}',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppThemeTokens.textMuted(context),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  teamA?['name'] as String? ?? 'TBD',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (isCompleted) ...[
                Text('$scoreA', style: const TextStyle(fontWeight: FontWeight.bold)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text('–',
                      style: TextStyle(color: AppThemeTokens.textMuted(context))),
                ),
                Text('$scoreB', style: const TextStyle(fontWeight: FontWeight.bold)),
              ] else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text('vs',
                      style: TextStyle(color: AppThemeTokens.textMuted(context))),
                ),
              Expanded(
                child: Text(
                  teamB?['name'] as String? ?? 'TBD',
                  textAlign: TextAlign.end,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          if (venue != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.location_on_outlined,
                    size: 12, color: AppThemeTokens.textMuted(context)),
                const SizedBox(width: 4),
                Text(
                  venue,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppThemeTokens.textMuted(context),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
