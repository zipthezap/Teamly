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

  bool _hasBracketData(TournamentMatchModel match) {
    return match.teamAId != null ||
        match.teamBId != null ||
        match.scoreA != null ||
        match.scoreB != null ||
        match.status.isNotEmpty;
  }

  int _roundSortKey(String roundLabel) {
    final normalized = roundLabel.toLowerCase();
    if (normalized == 'final') return 1000;
    if (normalized == 'semi-finals') return 999;

    final match = RegExp(r'(\d+)').firstMatch(roundLabel);
    if (match != null) {
      return int.tryParse(match.group(1)!) ?? 1;
    }

    return 1;
  }

  @override
  Widget build(BuildContext context) {
    final matches = tournament.matches.where(_hasBracketData).toList();

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
    final rounds = <String, List<TournamentMatchModel>>{};
    for (final m in matches) {
      rounds.putIfAbsent(m.round, () => []).add(m);
    }
    final sortedRounds = rounds.keys.toList()
      ..sort((a, b) => _roundSortKey(a).compareTo(_roundSortKey(b)));

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: sortedRounds.map((round) {
          final roundMatches = rounds[round]!;
          return _RoundColumn(roundLabel: round, matches: roundMatches);
        }).toList(),
      ),
    );
  }
}

class _RoundColumn extends StatelessWidget {
  const _RoundColumn({required this.roundLabel, required this.matches});

  final String roundLabel;
  final List<TournamentMatchModel> matches;

  String _roundLabel() {
    return roundLabel;
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

  final TournamentMatchModel match;

  @override
  Widget build(BuildContext context) {
    final scoreA = match.scoreA;
    final scoreB = match.scoreB;
    final isCompleted = match.status == 'completed';
    final aWins =
        isCompleted && scoreA != null && scoreB != null && scoreA > scoreB;
    final bWins =
        isCompleted && scoreA != null && scoreB != null && scoreB > scoreA;

    Widget teamRow(String? teamName, dynamic score, bool isWinner) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          children: [
            Expanded(
              child: Text(
                teamName ?? 'TBD',
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
          teamRow(match.teamAName, scoreA, aWins),
          Divider(height: 1, color: AppThemeTokens.border(context)),
          teamRow(match.teamBName, scoreB, bWins),
        ],
      ),
    );
  }
}
