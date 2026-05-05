import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../state/tournaments_notifier.dart';

class LiveScoresPage extends ConsumerStatefulWidget {
  const LiveScoresPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  ConsumerState<LiveScoresPage> createState() => _LiveScoresPageState();
}

class _LiveScoresPageState extends ConsumerState<LiveScoresPage> {
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    // Auto-refresh every 5 seconds while page is open for near-real-time scores
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      ref.invalidate(tournamentDetailProvider(widget.tournamentId));
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(tournamentDetailProvider(widget.tournamentId));

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Live Scores'),
        leading: BackButton(onPressed: () => context.pop()),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () =>
                ref.invalidate(tournamentDetailProvider(widget.tournamentId)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(message: e.toString()),
        data: (tournament) => _LiveScoresView(tournament: tournament),
      ),
    );
  }
}

class _LiveScoresView extends StatelessWidget {
  const _LiveScoresView({required this.tournament});

  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final allMatches = List<Map<String, dynamic>>.from(
      tournament.matches.whereType<Map<String, dynamic>>(),
    );

    final live = allMatches.where((m) => m['status'] == 'in_progress').toList();
    final recent = allMatches
        .where((m) => m['status'] == 'completed')
        .toList()
      ..sort((a, b) {
        final aT = a['completedAt'] as String? ?? a['updatedAt'] as String? ?? '';
        final bT = b['completedAt'] as String? ?? b['updatedAt'] as String? ?? '';
        return bT.compareTo(aT);
      });
    final upcoming = allMatches
        .where((m) =>
            m['status'] == 'scheduled' || m['status'] == 'pending')
        .toList()
      ..sort((a, b) {
        final aT = a['scheduledAt'] as String? ?? '';
        final bT = b['scheduledAt'] as String? ?? '';
        return aT.compareTo(bT);
      });

    if (allMatches.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.scoreboard_outlined,
                size: 64, color: AppThemeTokens.textMuted(context)),
            const SizedBox(height: 16),
            Text(
              'No matches available',
              style: TextStyle(color: AppThemeTokens.textSecondary(context)),
            ),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (live.isNotEmpty) ...[
          _SectionHeader(
            icon: Icons.circle,
            iconColor: AppThemeTokens.error,
            label: 'Live Now',
          ),
          const SizedBox(height: 8),
          ...live.map((m) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _ScoreCard(match: m, isLive: true),
              )),
          const SizedBox(height: 16),
        ],
        if (upcoming.isNotEmpty) ...[
          _SectionHeader(
            icon: Icons.schedule,
            iconColor: AppThemeTokens.info,
            label: 'Upcoming',
          ),
          const SizedBox(height: 8),
          ...upcoming.take(5).map((m) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _ScoreCard(match: m, isLive: false),
              )),
          const SizedBox(height: 16),
        ],
        if (recent.isNotEmpty) ...[
          _SectionHeader(
            icon: Icons.check_circle_outline,
            iconColor: AppThemeTokens.success,
            label: 'Recent Results',
          ),
          const SizedBox(height: 8),
          ...recent.take(10).map((m) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _ScoreCard(match: m, isLive: false),
              )),
        ],
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.iconColor,
    required this.label,
  });

  final IconData icon;
  final Color iconColor;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: iconColor),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 14,
            color: Theme.of(context).textTheme.titleMedium?.color,
          ),
        ),
      ],
    );
  }
}

class _ScoreCard extends StatelessWidget {
  const _ScoreCard({required this.match, required this.isLive});

  final Map<String, dynamic> match;
  final bool isLive;

  @override
  Widget build(BuildContext context) {
    final teamA = match['teamA'] as Map<String, dynamic>?;
    final teamB = match['teamB'] as Map<String, dynamic>?;
    final scoreA = match['scoreA'];
    final scoreB = match['scoreB'];
    final winnerId = match['winnerId'] as String?;
    final isCompleted = match['status'] == 'completed';

    Widget teamScoreRow(Map<String, dynamic>? team, dynamic score, bool top) {
      final isWinner = team != null && team['id'] == winnerId;
      return Padding(
        padding: EdgeInsets.only(
          left: 14,
          right: 14,
          top: top ? 10 : 4,
          bottom: top ? 4 : 10,
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                team?['name'] as String? ?? 'TBD',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isWinner ? FontWeight.bold : FontWeight.w500,
                  color: isWinner
                      ? AppThemeTokens.success
                      : Theme.of(context).textTheme.bodyMedium?.color,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (isCompleted || isLive)
              Text(
                score?.toString() ?? '–',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: isWinner
                      ? AppThemeTokens.success
                      : isLive
                          ? AppThemeTokens.primary500
                          : AppThemeTokens.textMuted(context),
                ),
              ),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.cardElevated(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color: isLive ? AppThemeTokens.error.withOpacity(0.4) : AppThemeTokens.border(context),
        ),
      ),
      child: Column(
        children: [
          if (isLive)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 3),
              decoration: BoxDecoration(
                color: AppThemeTokens.error.withOpacity(0.1),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.circle, size: 8, color: Colors.red),
                  const SizedBox(width: 4),
                  Text(
                    'LIVE',
                    style: TextStyle(
                      color: AppThemeTokens.error,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          teamScoreRow(teamA, scoreA, true),
          Divider(height: 1, color: AppThemeTokens.border(context)),
          teamScoreRow(teamB, scoreB, false),
        ],
      ),
    );
  }
}
