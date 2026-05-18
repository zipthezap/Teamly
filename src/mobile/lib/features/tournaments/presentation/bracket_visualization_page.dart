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

    // Build pool venue lookup: poolName → venue
    final poolVenueMap = <String, String>{};
    for (final pool in tournament.pools) {
      if (pool.venue != null) {
        poolVenueMap[pool.name] = pool.venue!;
      }
    }

    // Group matches by group/pool name (round label set from groupName on the model)
    final hasGroups = matches.any((m) => m.round.isNotEmpty && !m.round.startsWith('Round'));
    final groupedByStage = <String, List<TournamentMatchModel>>{};
    for (final m in matches) {
      final key = m.round.isNotEmpty ? m.round : 'Matches';
      groupedByStage.putIfAbsent(key, () => []).add(m);
    }

    if (hasGroups && groupedByStage.length > 1) {
      // Pool/groups view — vertical sections, horizontal round columns per section
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final entry in groupedByStage.entries) ...[
            _GroupSectionHeader(
              groupName: entry.key,
              venue: poolVenueMap[entry.key],
              matchCount: entry.value.length,
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 120,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: entry.value.map((m) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: SizedBox(
                    width: 220,
                    child: _MatchCard(match: m),
                  ),
                )).toList(),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ],
      );
    }

    // Group matches by round for standard bracket view.
    final rounds = <String, List<TournamentMatchModel>>{};
    for (final m in matches) {
      final round = m.round.isEmpty ? 'Round 1' : m.round;
      rounds.putIfAbsent(round, () => []).add(m);
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

class _GroupSectionHeader extends StatelessWidget {
  const _GroupSectionHeader({
    required this.groupName,
    this.venue,
    required this.matchCount,
  });

  final String groupName;
  final String? venue;
  final int matchCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppThemeTokens.primary500.withOpacity(0.12),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.primary500.withOpacity(0.25)),
      ),
      child: Row(
        children: [
          Icon(Icons.layers_outlined, size: 16, color: AppThemeTokens.primary500),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  groupName,
                  style: TextStyle(
                    color: AppThemeTokens.primary500,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                if (venue != null)
                  Row(
                    children: [
                      Icon(Icons.location_on_outlined, size: 11, color: AppThemeTokens.textMuted(context)),
                      const SizedBox(width: 3),
                      Text(
                        venue!,
                        style: TextStyle(fontSize: 11, color: AppThemeTokens.textMuted(context)),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          Text(
            '$matchCount match${matchCount == 1 ? '' : 'es'}',
            style: TextStyle(fontSize: 11, color: AppThemeTokens.textMuted(context)),
          ),
        ],
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
        width: 220,
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

    Widget teamRow(String? name, dynamic score) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          children: [
            Expanded(
              child: Text(
                name ?? 'TBD',
                style: TextStyle(
                  fontWeight: FontWeight.w500,
                  color: Theme.of(context).textTheme.bodyMedium?.color,
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
                  color: AppThemeTokens.textMuted(context),
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
        mainAxisSize: MainAxisSize.min,
        children: [
          teamRow(match.teamAName, scoreA),
          Divider(height: 1, color: AppThemeTokens.border(context)),
          teamRow(match.teamBName, scoreB),
          if (match.location != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
              child: Row(
                children: [
                  Icon(Icons.location_on_outlined, size: 10, color: AppThemeTokens.textMuted(context)),
                  const SizedBox(width: 3),
                  Expanded(
                    child: Text(
                      match.location!,
                      style: TextStyle(fontSize: 10, color: AppThemeTokens.textMuted(context)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
