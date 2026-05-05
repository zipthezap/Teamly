import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../state/tournaments_notifier.dart';

class BracketVisualizationPage extends ConsumerWidget {
  const BracketVisualizationPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(tournamentDetailProvider(tournamentId));

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Bracket'),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(message: e.toString()),
        data: (tournament) => _BracketView(tournament: tournament),
      ),
    );
  }
}

class _BracketView extends StatelessWidget {
  const _BracketView({required this.tournament});

  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final matches = tournament.matches
        .where((m) => m['stage'] != null || m['round'] != null)
        .toList();

    if (matches.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.account_tree_outlined,
                size: 64, color: AppThemeTokens.textMuted(context)),
            const SizedBox(height: 16),
            Text(
              'Bracket not yet generated',
              style: TextStyle(color: AppThemeTokens.textSecondary(context)),
            ),
          ],
        ),
      );
    }

    // Group matches by round
    final rounds = <int, List<Map<String, dynamic>>>{};
    for (final m in matches) {
      final round = (m['round'] as num?)?.toInt() ?? 1;
      rounds.putIfAbsent(round, () => []).add(m as Map<String, dynamic>);
    }
    final sortedRounds = rounds.keys.toList()..sort();

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: sortedRounds.map((round) {
          final roundMatches = rounds[round]!;
          return _RoundColumn(round: round, matches: roundMatches);
        }).toList(),
      ),
    );
  }
}

class _RoundColumn extends StatelessWidget {
  const _RoundColumn({required this.round, required this.matches});

  final int round;
  final List<Map<String, dynamic>> matches;

  String _roundLabel() {
    switch (round) {
      case -1:
        return 'Final';
      case -2:
        return 'Semi-Finals';
      default:
        return 'Round $round';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: SizedBox(
        width: 200,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppThemeTokens.primary500.withOpacity(0.15),
                borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
              ),
              child: Text(
                _roundLabel(),
                style: TextStyle(
                  color: AppThemeTokens.primary500,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(height: 8),
            ...matches.map((m) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _MatchCard(match: m),
                )),
          ],
        ),
      ),
    );
  }
}

class _MatchCard extends StatelessWidget {
  const _MatchCard({required this.match});

  final Map<String, dynamic> match;

  @override
  Widget build(BuildContext context) {
    final teamA = match['teamA'] as Map<String, dynamic>?;
    final teamB = match['teamB'] as Map<String, dynamic>?;
    final scoreA = match['scoreA'];
    final scoreB = match['scoreB'];
    final isCompleted = match['status'] == 'completed';
    final winnerId = match['winnerId'] as String?;

    Widget teamRow(Map<String, dynamic>? team, dynamic score) {
      final isWinner = team != null && team['id'] == winnerId;
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          children: [
            Expanded(
              child: Text(
                team?['name'] as String? ?? 'TBD',
                style: TextStyle(
                  fontWeight: isWinner ? FontWeight.bold : FontWeight.normal,
                  color: isWinner
                      ? AppThemeTokens.success
                      : Theme.of(context).textTheme.bodyMedium?.color,
                  fontSize: 13,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (isCompleted && score != null)
              Text(
                '$score',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: isWinner
                      ? AppThemeTokens.success
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
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      child: Column(
        children: [
          teamRow(teamA, scoreA),
          Divider(height: 1, color: AppThemeTokens.border(context)),
          teamRow(teamB, scoreB),
        ],
      ),
    );
  }
}
