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
        .where((m) => m.status.isNotEmpty)
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

    // Single elimination / round-robin — show rounds as horizontal columns
    final rawMatches = tournament.matches
        .map((m) => <String, dynamic>{
              'id': m.id,
              'round': m.round,
              'status': m.status,
              'teamAId': m.teamAId,
              'teamBId': m.teamBId,
              'teamAName': m.teamAName,
              'teamBName': m.teamBName,
              'scoreA': m.scoreA,
              'scoreB': m.scoreB,
              'location': m.location,
            })
        .toList();

    // Group by round label
    final rounds = <String, List<Map<String, dynamic>>>{};
    for (final m in rawMatches) {
      final round = m['round'] as String? ?? 'Round 1';
      rounds.putIfAbsent(round, () => []).add(m);
    }
    final sortedRounds = rounds.keys.toList()
      ..sort((a, b) {
        // Keep special stage names at the end
        final aNum = int.tryParse(a.replaceAll(RegExp(r'[^0-9]'), ''));
        final bNum = int.tryParse(b.replaceAll(RegExp(r'[^0-9]'), ''));
        if (aNum != null && bNum != null) return aNum.compareTo(bNum);
        return a.compareTo(b);
      });

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
  const _RoundColumn({required this.round, required this.matches});

  final String round;
  final List<Map<String, dynamic>> matches;

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
                round,
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

  /// Accepts either a [TournamentMatchModel] or a raw [Map<String, dynamic>].
  final dynamic match;

  @override
  Widget build(BuildContext context) {
    late final String? teamAName;
    late final String? teamBName;
    late final dynamic scoreA;
    late final dynamic scoreB;
    late final String status;
    late final String? location;

    if (match is TournamentMatchModel) {
      final m = match as TournamentMatchModel;
      teamAName = m.teamAName;
      teamBName = m.teamBName;
      scoreA = m.scoreA;
      scoreB = m.scoreB;
      status = m.status;
      location = m.location;
    } else {
      final m = match as Map<String, dynamic>;
      teamAName = m['teamAName'] as String?;
      teamBName = m['teamBName'] as String?;
      scoreA = m['scoreA'];
      scoreB = m['scoreB'];
      status = m['status'] as String? ?? 'scheduled';
      location = m['location'] as String?;
    }

    final isCompleted = status == 'completed';

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
          teamRow(teamAName, scoreA),
          Divider(height: 1, color: AppThemeTokens.border(context)),
          teamRow(teamBName, scoreB),
          if (location != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
              child: Row(
                children: [
                  Icon(Icons.location_on_outlined, size: 10, color: AppThemeTokens.textMuted(context)),
                  const SizedBox(width: 3),
                  Expanded(
                    child: Text(
                      location!,
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
