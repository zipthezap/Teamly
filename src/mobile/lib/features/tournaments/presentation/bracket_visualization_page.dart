import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../state/tournaments_notifier.dart';

const _kAccentBracket = Color(0xFFFF9800);

// ---------------------------------------------------------------------------
// Standalone bracket page
// ---------------------------------------------------------------------------

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
        data: (tournament) => TournamentBracketView(tournament: tournament),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Public shared widget used by both the standalone page and the Brackets tab
// ---------------------------------------------------------------------------

class TournamentBracketView extends StatelessWidget {
  const TournamentBracketView({super.key, required this.tournament});

  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final matches = tournament.matches;

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

    final isPool = tournament.format == 'round_robin' ||
        tournament.format == 'groups_knockout' ||
        tournament.format == 'pool';

    if (isPool) {
      return _PoolBracketView(tournament: tournament);
    }

    return _SingleEliminationView(tournament: tournament);
  }
}

// ---------------------------------------------------------------------------
// Pool / round-robin format: sections per category, then per group/round
// ---------------------------------------------------------------------------

class _PoolBracketView extends StatelessWidget {
  const _PoolBracketView({required this.tournament});

  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final matches = tournament.matches;

    // Build: poolName → categoryName
    final poolCategoryMap = <String, String>{};
    for (final pool in tournament.pools) {
      if (pool.categoryName != null) {
        poolCategoryMap[pool.name] = pool.categoryName!;
      }
    }

    // Group by category first, then by round/group within
    final hasCategories = tournament.categories.length > 1;

    if (hasCategories) {
      // Build: categoryName → groupName → matches
      // m.round for pool-stage matches is set from the pool's groupName in the backend,
      // which equals pool.name — so poolCategoryMap[m.round] correctly resolves the category.
      final Map<String, Map<String, List<TournamentMatchModel>>> byCat = {};
      for (final m in matches) {
        final cat = poolCategoryMap[m.round] ?? 'General';
        final group = m.round;
        byCat.putIfAbsent(cat, () => {}).putIfAbsent(group, () => []).add(m);
      }

      return DefaultTabController(
        length: byCat.length,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: byCat.keys.map((cat) => Tab(text: cat)).toList(),
            ),
            Expanded(
              child: TabBarView(
                children: byCat.values.map((byGroup) {
                  return _PoolGroupListView(
                    byGroup: byGroup,
                    poolVenueMap: {
                      for (final p in tournament.pools)
                        if (p.venue != null) p.name: p.venue!
                    },
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      );
    }

    // No categories — single pool list
    final Map<String, List<TournamentMatchModel>> byRound = {};
    for (final m in matches) {
      byRound.putIfAbsent(m.round.isEmpty ? 'Matches' : m.round, () => []).add(m);
    }
    return _PoolGroupListView(
      byGroup: byRound,
      poolVenueMap: {
        for (final p in tournament.pools)
          if (p.venue != null) p.name: p.venue!
      },
    );
  }
}

class _PoolGroupListView extends StatelessWidget {
  const _PoolGroupListView(
      {required this.byGroup, required this.poolVenueMap});

  final Map<String, List<TournamentMatchModel>> byGroup;
  final Map<String, String> poolVenueMap;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (final entry in byGroup.entries) ...[
          _PoolGroupHeader(
            groupName: entry.key,
            venue: poolVenueMap[entry.key],
            matchCount: entry.value.length,
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 120,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: entry.value
                  .map((m) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: SizedBox(width: 200, child: _SmallMatchCard(match: m)),
                      ))
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ],
    );
  }
}

class _PoolGroupHeader extends StatelessWidget {
  const _PoolGroupHeader(
      {required this.groupName, this.venue, required this.matchCount});

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
                  style: const TextStyle(
                    color: AppThemeTokens.primary500,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                if (venue != null)
                  Row(
                    children: [
                      Icon(Icons.location_on_outlined,
                          size: 11, color: AppThemeTokens.textMuted(context)),
                      const SizedBox(width: 3),
                      Text(venue!,
                          style: TextStyle(
                              fontSize: 11,
                              color: AppThemeTokens.textMuted(context))),
                    ],
                  ),
              ],
            ),
          ),
          Text(
            '$matchCount match${matchCount == 1 ? '' : 'es'}',
            style: TextStyle(
                fontSize: 11, color: AppThemeTokens.textMuted(context)),
          ),
        ],
      ),
    );
  }
}

class _SmallMatchCard extends StatelessWidget {
  const _SmallMatchCard({required this.match});

  final TournamentMatchModel match;

  @override
  Widget build(BuildContext context) {
    final hasScore = match.scoreA != null && match.scoreB != null;
    final aWins = hasScore && match.scoreA! > match.scoreB!;
    final bWins = hasScore && match.scoreB! > match.scoreA!;

    Widget row(String? name, int? score, bool wins) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  name ?? 'TBD',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: wins ? FontWeight.bold : FontWeight.w500,
                    color: name == null
                        ? AppThemeTokens.textMuted(context)
                        : Theme.of(context).textTheme.bodyMedium?.color,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (score != null)
                Text('$score',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: wins
                            ? AppThemeTokens.primary400
                            : AppThemeTokens.textSecondary(context))),
            ],
          ),
        );

    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.cardElevated(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          row(match.teamAName, match.scoreA, aWins),
          Divider(height: 1, color: AppThemeTokens.border(context)),
          row(match.teamBName, match.scoreB, bWins),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Single-elimination: visual bracket with connecting lines
// ---------------------------------------------------------------------------

class _SingleEliminationView extends StatelessWidget {
  const _SingleEliminationView({required this.tournament});

  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final matches = tournament.matches;

    // Build poolId → categoryName from pools
    final poolCategoryMap = <String, String>{};
    for (final pool in tournament.pools) {
      if (pool.categoryName != null) {
        poolCategoryMap[pool.id] = pool.categoryName!;
      }
    }

    // Build teamId → categoryName via team's poolId
    final teamCategoryMap = <String, String>{};
    for (final team in tournament.teams) {
      if (team.poolId != null && poolCategoryMap.containsKey(team.poolId)) {
        teamCategoryMap[team.id] = poolCategoryMap[team.poolId!]!;
      }
    }

    // Assign each match a category (use teamA's category if available)
    final Map<String, List<TournamentMatchModel>> byCategory = {};
    for (final m in matches) {
      String cat = 'Open';
      if (m.teamAId != null && teamCategoryMap.containsKey(m.teamAId)) {
        cat = teamCategoryMap[m.teamAId]!;
      } else if (m.teamBId != null && teamCategoryMap.containsKey(m.teamBId)) {
        cat = teamCategoryMap[m.teamBId]!;
      }
      byCategory.putIfAbsent(cat, () => []).add(m);
    }

    // Sort categories to match tournament.categories order.
    // Pre-compute index map for O(n log n) sort instead of O(n²).
    final orderedCatNames = tournament.categories.map((c) => c.name).toList();
    final catIndexMap = <String, int>{
      for (int i = 0; i < orderedCatNames.length; i++) orderedCatNames[i]: i,
    };
    final sortedCats = byCategory.keys.toList()
      ..sort((a, b) {
        final ai = catIndexMap[a] ?? 999;
        final bi = catIndexMap[b] ?? 999;
        if (ai != bi) return ai.compareTo(bi);
        return a.compareTo(b);
      });

    final hasMultipleCategories = sortedCats.length > 1 ||
        (sortedCats.length == 1 && sortedCats[0] != 'Open');

    if (hasMultipleCategories && sortedCats.length > 1) {
      return DefaultTabController(
        length: sortedCats.length,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: sortedCats.map((cat) => Tab(text: cat)).toList(),
            ),
            Expanded(
              child: TabBarView(
                children: sortedCats.map((cat) {
                  return _VisualBracketCanvas(matches: byCategory[cat]!);
                }).toList(),
              ),
            ),
          ],
        ),
      );
    }

    return _VisualBracketCanvas(matches: matches);
  }
}

// ---------------------------------------------------------------------------
// Visual bracket canvas: match cards + connector lines
// ---------------------------------------------------------------------------

// Layout constants
const double _kMatchW = 160.0;
const double _kMatchH = 62.0;
const double _kUnit = 82.0; // vertical unit = spacing between round-1 match centers
const double _kColW = 208.0; // column width = match width + horizontal gap
const double _kWinnerW = 180.0; // width reserved for winner badge

/// Maps a round label to a sort order (lower = earlier round).
/// Generic "Round N" labels get order = N * _kRoundOrderStep.
const int _kRoundOrderStep = 5;

int _bracketRoundOrder(String label) {
  final l = label.toLowerCase().trim();
  if (l == 'finals' || l == 'final') return 100;
  if (l.contains('semi')) return 80;
  if (l.contains('quarter')) return 60;
  if (l.contains('round of 16')) return 40;
  if (l.contains('round of 32')) return 20;
  if (l.contains('round of 64')) return 10;
  final m = RegExp(r'(\d+)').firstMatch(l);
  return m != null
      ? (int.tryParse(m.group(1)!) ?? 1) * _kRoundOrderStep
      : _kRoundOrderStep;
}

/// Center Y for match [i] in round [r], given vertical unit [unit].
double _matchCenterY(int r, int i, double unit) {
  if (r == 0) return unit * (i + 0.5);
  return unit * (1 << (r - 1)) * (2 * i + 1).toDouble();
}

class _VisualBracketCanvas extends StatelessWidget {
  const _VisualBracketCanvas({required this.matches});

  final List<TournamentMatchModel> matches;

  @override
  Widget build(BuildContext context) {
    // Group and sort by round
    final Map<String, List<TournamentMatchModel>> byRound = {};
    for (final m in matches) {
      final key = m.round.isEmpty ? 'Round 1' : m.round;
      byRound.putIfAbsent(key, () => []).add(m);
    }
    final sortedKeys = byRound.keys.toList()
      ..sort((a, b) => _bracketRoundOrder(a).compareTo(_bracketRoundOrder(b)));
    final rounds = sortedKeys.map((k) => byRound[k]!).toList();

    if (rounds.isEmpty) return const SizedBox();

    final numR0 = rounds[0].length;
    final canvasH = numR0 * _kUnit;
    final canvasW = rounds.length * _kColW;

    // Pre-compute center Ys per round
    final centerYs = <List<double>>[];
    for (int r = 0; r < rounds.length; r++) {
      centerYs.add([
        for (int i = 0; i < rounds[r].length; i++)
          _matchCenterY(r, i, _kUnit)
      ]);
    }

    // Determine winner
    String? winnerName;
    if (rounds.isNotEmpty && rounds.last.isNotEmpty) {
      final finalMatch = rounds.last[0];
      final hasScore = finalMatch.scoreA != null && finalMatch.scoreB != null;
      if (hasScore) {
        if (finalMatch.scoreA! > finalMatch.scoreB!) {
          winnerName = finalMatch.teamAName;
        } else if (finalMatch.scoreB! > finalMatch.scoreA!) {
          winnerName = finalMatch.teamBName;
        }
      }
    }

    final lineColor = AppThemeTokens.border(context);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 16),
        child: SizedBox(
          width: canvasW + _kWinnerW,
          height: canvasH,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Bracket connector lines
              Positioned.fill(
                child: CustomPaint(
                  painter: _BracketLinePainter(
                    rounds: rounds,
                    centerYs: centerYs,
                    lineColor: lineColor,
                  ),
                ),
              ),

              // Match cards
              for (int r = 0; r < rounds.length; r++)
                for (int i = 0; i < rounds[r].length; i++)
                  Positioned(
                    left: r * _kColW,
                    top: centerYs[r][i] - _kMatchH / 2,
                    width: _kMatchW,
                    height: _kMatchH,
                    child: _BracketMatchCard(
                      match: rounds[r][i],
                      isFinal: r == rounds.length - 1,
                    ),
                  ),

              // Winner badge to the right of the last column
              if (winnerName != null)
                Positioned(
                  left: canvasW + 12,
                  top: canvasH / 2 - 58,
                  width: _kWinnerW - 20,
                  child: _WinnerBadge(name: winnerName),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bracket connector line painter
// ---------------------------------------------------------------------------

class _BracketLinePainter extends CustomPainter {
  const _BracketLinePainter({
    required this.rounds,
    required this.centerYs,
    required this.lineColor,
  });

  final List<List<TournamentMatchModel>> rounds;
  final List<List<double>> centerYs;
  final Color lineColor;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = lineColor
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final halfGap = (_kColW - _kMatchW) / 2;

    for (int r = 0; r < rounds.length - 1; r++) {
      final connX = r * _kColW + _kMatchW + halfGap;
      final nextCount = rounds[r + 1].length;
      final currCount = rounds[r].length;

      for (int j = 0; j < nextCount; j++) {
        final fi1 = 2 * j;
        final fi2 = 2 * j + 1;
        final parentY = centerYs[r + 1][j];

        // Horizontal arm from feeder 1 right edge → connector X
        if (fi1 < currCount) {
          final y1 = centerYs[r][fi1];
          canvas.drawLine(
            Offset(r * _kColW + _kMatchW, y1),
            Offset(connX, y1),
            paint,
          );
        }

        // Horizontal arm from feeder 2 right edge → connector X
        if (fi2 < currCount) {
          final y2 = centerYs[r][fi2];
          canvas.drawLine(
            Offset(r * _kColW + _kMatchW, y2),
            Offset(connX, y2),
            paint,
          );

          // Vertical connector between both feeders
          if (fi1 < currCount) {
            canvas.drawLine(
              Offset(connX, centerYs[r][fi1]),
              Offset(connX, y2),
              paint,
            );
          }
        }

        // Arm from connector midpoint → left edge of parent match
        canvas.drawLine(
          Offset(connX, parentY),
          Offset((r + 1) * _kColW, parentY),
          paint,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _BracketLinePainter old) =>
      old.lineColor != lineColor ||
      old.rounds.length != rounds.length;
}

// ---------------------------------------------------------------------------
// Bracket match card
// ---------------------------------------------------------------------------

class _BracketMatchCard extends StatelessWidget {
  const _BracketMatchCard({required this.match, this.isFinal = false});

  final TournamentMatchModel match;
  final bool isFinal;

  @override
  Widget build(BuildContext context) {
    final m = match;
    final hasScore = m.scoreA != null && m.scoreB != null;
    final aWins = hasScore && m.scoreA! > m.scoreB!;
    final bWins = hasScore && m.scoreB! > m.scoreA!;

    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.cardElevated(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color: isFinal
              ? _kAccentBracket.withOpacity(0.5)
              : AppThemeTokens.border(context),
          width: isFinal ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        children: [
          Expanded(
            child: _BracketTeamRow(
              name: m.teamAName,
              score: m.scoreA,
              isWinner: aWins,
            ),
          ),
          Divider(height: 1, color: AppThemeTokens.border(context)),
          Expanded(
            child: _BracketTeamRow(
              name: m.teamBName,
              score: m.scoreB,
              isWinner: bWins,
            ),
          ),
        ],
      ),
    );
  }
}

class _BracketTeamRow extends StatelessWidget {
  const _BracketTeamRow(
      {required this.name, this.score, required this.isWinner});

  final String? name;
  final int? score;
  final bool isWinner;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: isWinner
          ? BoxDecoration(
              color: AppThemeTokens.primary500.withOpacity(0.08),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd - 1),
            )
          : null,
      child: Row(
        children: [
          if (isWinner)
            const Icon(Icons.star_rounded, size: 10, color: _kAccentBracket)
          else
            const SizedBox(width: 10),
          const SizedBox(width: 3),
          Expanded(
            child: Text(
              name ?? 'TBD',
              style: TextStyle(
                fontSize: 11,
                fontWeight: isWinner ? FontWeight.bold : FontWeight.w500,
                color: name == null
                    ? AppThemeTokens.textMuted(context)
                    : Theme.of(context).textTheme.bodyMedium?.color,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
          if (score != null) ...[
            const SizedBox(width: 4),
            Text(
              '$score',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: isWinner
                    ? AppThemeTokens.primary400
                    : AppThemeTokens.textSecondary(context),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Winner badge shown to the right of the bracket
// ---------------------------------------------------------------------------

class _WinnerBadge extends StatelessWidget {
  const _WinnerBadge({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.emoji_events_rounded, size: 44, color: _kAccentBracket),
        const SizedBox(height: 6),
        Text(
          'WINNER',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: AppThemeTokens.textMuted(context),
            letterSpacing: 2.5,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: _kAccentBracket.withOpacity(0.14),
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(color: _kAccentBracket.withOpacity(0.45)),
          ),
          child: Text(
            name,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: _kAccentBracket,
            ),
          ),
        ),
      ],
    );
  }
}
