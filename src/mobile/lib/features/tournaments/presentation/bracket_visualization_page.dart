import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../state/tournaments_notifier.dart';

const _kAccentBracket = Color(0xFFFF9800);
const double _kMatchW = 160.0;
const double _kMatchH = 62.0;
const double _kUnit = 82.0;
const double _kColW = 208.0;
const double _kWinnerW = 180.0;
const double _kColumnHeaderH = 40.0;

const List<String> _kEliminationStageOrder = [
  'round_of_32',
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'finals',
];

const List<String> _kGroupsKnockoutStageOrder = [
  'round_of_16',
  'quarter_finals',
  'semi_finals',
  'finals',
];

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

    if (tournament.format == 'groups_knockout') {
      return _GroupsKnockoutView(tournament: tournament);
    }

    final isPool = tournament.format == 'round_robin' || tournament.format == 'pool';
    if (isPool) {
      return _PoolBracketView(tournament: tournament);
    }

    return _SingleEliminationView(tournament: tournament);
  }
}

class _GroupsKnockoutView extends StatelessWidget {
  const _GroupsKnockoutView({required this.tournament});

  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final knockoutMatches = tournament.matches
        .where((m) => m.stage != null && m.stage != 'group_stage')
        .toList();

    if (knockoutMatches.isNotEmpty) {
      return _KnockoutBracketView(
        matches: knockoutMatches,
        useGroupsKnockoutLabels: true,
      );
    }

    final projectedMatches = _buildProjectedKnockoutMatches(tournament);
    if (projectedMatches.isNotEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const _StageSectionHeader(
            title: 'Projected Playoffs',
            subtitle: 'Top teams from groups are seeded into a 4, 8, or 16-team playoff bracket.',
          ),
          const SizedBox(height: 12),
          _KnockoutBracketView(
            matches: projectedMatches,
            useGroupsKnockoutLabels: true,
          ),
        ],
      );
    }

    final groupMatches = tournament.matches
        .where((m) => m.stage == 'group_stage' || m.groupName != null)
        .toList();
    final allGroupMatchesCompleted =
        groupMatches.isNotEmpty && groupMatches.every((m) => m.status == 'completed');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _StageSectionHeader(
          title: 'Knockout Bracket',
          subtitle: allGroupMatchesCompleted
              ? 'Waiting for group standings to seed the playoff bracket.'
              : 'Complete group-stage matches to seed the playoff bracket.',
        ),
        const SizedBox(height: 12),
        _KnockoutWaitingCard(allGroupMatchesCompleted: allGroupMatchesCompleted),
      ],
    );
  }
}

class _KnockoutWaitingCard extends StatelessWidget {
  const _KnockoutWaitingCard({required this.allGroupMatchesCompleted});

  final bool allGroupMatchesCompleted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppThemeTokens.cardElevated(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      child: Row(
        children: [
          Icon(
            allGroupMatchesCompleted ? Icons.schedule_outlined : Icons.hourglass_bottom_outlined,
            color: AppThemeTokens.primary500,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              allGroupMatchesCompleted
                  ? 'The playoff bracket will appear once the group-stage standings finish syncing.'
                  : 'No playoff bracket yet. Finish the remaining group-stage matches first.',
              style: TextStyle(color: AppThemeTokens.textSecondary(context)),
            ),
          ),
        ],
      ),
    );
  }
}

class _StageSectionHeader extends StatelessWidget {
  const _StageSectionHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: TextStyle(color: AppThemeTokens.textSecondary(context)),
        ),
      ],
    );
  }
}

class _PoolBracketView extends StatelessWidget {
  const _PoolBracketView({required this.tournament});

  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final matches = tournament.matches;
    final poolCategoryMap = <String, String>{};
    for (final pool in tournament.pools) {
      if (pool.categoryName != null) {
        poolCategoryMap[pool.name] = pool.categoryName!;
      }
    }

    final hasCategories = tournament.categories.length > 1;
    if (hasCategories) {
      final Map<String, Map<String, List<TournamentMatchModel>>> byCat = {};
      for (final m in matches) {
        final key = m.groupName ?? m.round;
        final cat = poolCategoryMap[key] ?? 'General';
        byCat.putIfAbsent(cat, () => {}).putIfAbsent(key, () => []).add(m);
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
                        if (p.venue != null) p.name: p.venue!,
                    },
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      );
    }

    final Map<String, List<TournamentMatchModel>> byRound = {};
    for (final m in matches) {
      final key = m.groupName ?? (m.round.isEmpty ? 'Matches' : m.round);
      byRound.putIfAbsent(key, () => []).add(m);
    }
    return _PoolGroupListView(
      byGroup: byRound,
      poolVenueMap: {
        for (final p in tournament.pools)
          if (p.venue != null) p.name: p.venue!,
      },
    );
  }
}

class _PoolGroupListView extends StatelessWidget {
  const _PoolGroupListView({required this.byGroup, required this.poolVenueMap});

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
  const _PoolGroupHeader({required this.groupName, this.venue, required this.matchCount});

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
                      Text(
                        venue!,
                        style: TextStyle(
                          fontSize: 11,
                          color: AppThemeTokens.textMuted(context),
                        ),
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
                Text(
                  '$score',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: wins
                        ? AppThemeTokens.primary400
                        : AppThemeTokens.textSecondary(context),
                  ),
                ),
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

class _SingleEliminationView extends StatelessWidget {
  const _SingleEliminationView({required this.tournament});

  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final matches = tournament.matches;
    final poolCategoryMap = <String, String>{};
    for (final pool in tournament.pools) {
      if (pool.categoryName != null) {
        poolCategoryMap[pool.id] = pool.categoryName!;
      }
    }

    final teamCategoryMap = <String, String>{};
    for (final team in tournament.teams) {
      if (team.poolId != null && poolCategoryMap.containsKey(team.poolId)) {
        teamCategoryMap[team.id] = poolCategoryMap[team.poolId!]!;
      }
    }

    final Map<String, List<TournamentMatchModel>> byCategory = {};
    for (final m in matches) {
      var cat = 'Open';
      if (m.teamAId != null && teamCategoryMap.containsKey(m.teamAId)) {
        cat = teamCategoryMap[m.teamAId]!;
      } else if (m.teamBId != null && teamCategoryMap.containsKey(m.teamBId)) {
        cat = teamCategoryMap[m.teamBId]!;
      }
      byCategory.putIfAbsent(cat, () => []).add(m);
    }

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
                  return _KnockoutBracketView(matches: byCategory[cat]!);
                }).toList(),
              ),
            ),
          ],
        ),
      );
    }

    return _KnockoutBracketView(matches: matches);
  }
}

class _KnockoutBracketView extends StatelessWidget {
  const _KnockoutBracketView({required this.matches, this.useGroupsKnockoutLabels = false});

  final List<TournamentMatchModel> matches;
  final bool useGroupsKnockoutLabels;

  @override
  Widget build(BuildContext context) {
    final columns = _buildBracketColumns(
      matches,
      useGroupsKnockoutLabels: useGroupsKnockoutLabels,
    );

    if (columns.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppThemeTokens.cardElevated(context),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.border(context)),
        ),
        child: Text(
          'No knockout matches available yet.',
          style: TextStyle(color: AppThemeTokens.textSecondary(context)),
        ),
      );
    }

    return _VisualBracketCanvas(columns: columns);
  }
}

class _BracketColumn {
  const _BracketColumn({required this.key, required this.label, required this.matches});

  final String key;
  final String label;
  final List<_BracketCanvasMatch> matches;
}

class _BracketCanvasMatch {
  const _BracketCanvasMatch({
    required this.label,
    this.teamAName,
    this.teamBName,
    this.scoreA,
    this.scoreB,
    this.status = 'scheduled',
    this.isActual = true,
  });

  final String label;
  final String? teamAName;
  final String? teamBName;
  final int? scoreA;
  final int? scoreB;
  final String status;
  final bool isActual;

  factory _BracketCanvasMatch.fromModel(
    TournamentMatchModel match, {
    String? fallbackTeamAName,
    String? fallbackTeamBName,
    required String label,
  }) {
    return _BracketCanvasMatch(
      label: label,
      teamAName: match.teamAName ?? fallbackTeamAName,
      teamBName: match.teamBName ?? fallbackTeamBName,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      status: match.status,
      isActual: true,
    );
  }
}

List<_BracketColumn> _buildBracketColumns(
  List<TournamentMatchModel> matches, {
  bool useGroupsKnockoutLabels = false,
}) {
  final knockoutMatches = matches.where((m) => m.stage != 'group_stage').toList();
  final usesExplicitStages = knockoutMatches.any((m) => m.stage != null && m.stage!.isNotEmpty);

  if (usesExplicitStages) {
    return _buildStageColumns(
      knockoutMatches.where((m) => m.stage != null && m.stage!.isNotEmpty).toList(),
      useGroupsKnockoutLabels: useGroupsKnockoutLabels,
    );
  }

  return _buildLegacyRoundColumns(matches);
}

List<_BracketColumn> _buildStageColumns(
  List<TournamentMatchModel> matches, {
  bool useGroupsKnockoutLabels = false,
}) {
  final stageOrder = useGroupsKnockoutLabels ? _kGroupsKnockoutStageOrder : _kEliminationStageOrder;
  final byStage = <String, List<TournamentMatchModel>>{};
  for (final match in matches) {
    final stage = match.stage;
    if (stage == null) continue;
    byStage.putIfAbsent(stage, () => []).add(match);
  }

  final presentStageIndexes = byStage.keys
      .map((stage) => stageOrder.indexOf(stage))
      .where((index) => index >= 0)
      .toList();
  if (presentStageIndexes.isEmpty) {
    return [];
  }

  final firstIndex = presentStageIndexes.reduce((a, b) => a < b ? a : b);
  final orderedStages = stageOrder.sublist(firstIndex);

  final columns = <_BracketColumn>[];
  List<_BracketCanvasMatch> previousRound = const [];

  for (final stage in orderedStages) {
    final stageMatches = [...(byStage[stage] ?? const <TournamentMatchModel>[])];
    stageMatches.sort((a, b) {
      final orderA = a.matchOrder ?? 999;
      final orderB = b.matchOrder ?? 999;
      if (orderA != orderB) return orderA.compareTo(orderB);
      final roundA = a.roundNumber ?? 999;
      final roundB = b.roundNumber ?? 999;
      if (roundA != roundB) return roundA.compareTo(roundB);
      return (a.teamAName ?? '').compareTo(b.teamAName ?? '');
    });

    final label = _stageLabel(stage, useGroupsKnockoutLabels: useGroupsKnockoutLabels);
    final roundMatches = columns.isEmpty
        ? stageMatches
            .map((match) => _BracketCanvasMatch.fromModel(match, label: label))
            .toList()
        : List.generate((previousRound.length / 2).ceil(), (index) {
            final feederA = previousRound[index * 2];
            final feederB = previousRound[index * 2 + 1];
            final actual = index < stageMatches.length ? stageMatches[index] : null;
            final fallbackA = _winnerName(feederA);
            final fallbackB = _winnerName(feederB);
            if (actual != null) {
              return _BracketCanvasMatch.fromModel(
                actual,
                fallbackTeamAName: fallbackA,
                fallbackTeamBName: fallbackB,
                label: label,
              );
            }
            return _BracketCanvasMatch(
              label: label,
              teamAName: fallbackA,
              teamBName: fallbackB,
              isActual: false,
            );
          });

    columns.add(_BracketColumn(key: stage, label: label, matches: roundMatches));
    previousRound = roundMatches;
    if (previousRound.length <= 1) {
      break;
    }
  }

  return columns.where((column) => column.matches.isNotEmpty).toList();
}

List<_BracketColumn> _buildLegacyRoundColumns(List<TournamentMatchModel> matches) {
  final byRound = <String, List<TournamentMatchModel>>{};
  for (final match in matches) {
    final key = match.round.isEmpty ? 'Round 1' : match.round;
    byRound.putIfAbsent(key, () => []).add(match);
  }

  final sortedKeys = byRound.keys.toList()
    ..sort((a, b) => _bracketRoundOrder(a).compareTo(_bracketRoundOrder(b)));

  return sortedKeys
      .map(
        (key) => _BracketColumn(
          key: key,
          label: key,
          matches: byRound[key]!
              .map((match) => _BracketCanvasMatch.fromModel(match, label: key))
              .toList(),
        ),
      )
      .toList();
}

String _stageLabel(String stage, {bool useGroupsKnockoutLabels = false}) {
  switch (stage) {
    case 'round_of_32':
      return 'Round of 32';
    case 'round_of_16':
      return useGroupsKnockoutLabels ? 'Playoffs' : 'Round of 16';
    case 'quarter_finals':
      return 'Quarterfinals';
    case 'semi_finals':
      return 'Semifinals';
    case 'finals':
      return 'Finals';
    default:
      final normalized = stage.replaceAll('_', ' ');
      return normalized.isEmpty
          ? 'Bracket'
          : normalized[0].toUpperCase() + normalized.substring(1);
  }
}

String? _winnerName(_BracketCanvasMatch match) {
  final hasScore = match.scoreA != null && match.scoreB != null;
  if (!hasScore) return null;
  if (match.scoreA! > match.scoreB!) return match.teamAName;
  if (match.scoreB! > match.scoreA!) return match.teamBName;
  return null;
}

int _bracketRoundOrder(String label) {
  final l = label.toLowerCase().trim();
  if (l == 'finals' || l == 'final') return 100;
  if (l.contains('semi')) return 80;
  if (l.contains('quarter')) return 60;
  if (l.contains('round of 16')) return 40;
  if (l.contains('round of 32')) return 20;
  if (l.contains('round of 64')) return 10;
  final m = RegExp(r'(\d+)').firstMatch(l);
  return m != null ? (int.tryParse(m.group(1)!) ?? 1) * 5 : 5;
}

double _matchCenterY(int columnIndex, int matchIndex, double unit) {
  if (columnIndex == 0) return _kColumnHeaderH + unit * (matchIndex + 0.5);
  return _kColumnHeaderH + unit * (1 << (columnIndex - 1)) * (2 * matchIndex + 1).toDouble();
}

class _VisualBracketCanvas extends StatelessWidget {
  const _VisualBracketCanvas({required this.columns});

  final List<_BracketColumn> columns;

  @override
  Widget build(BuildContext context) {
    final rounds = columns.map((column) => column.matches).toList();
    if (rounds.isEmpty) return const SizedBox();

    final numR0 = rounds.first.length;
    final canvasH = (numR0 * _kUnit) + _kColumnHeaderH;
    final canvasW = columns.length * _kColW;

    final centerYs = <List<double>>[];
    for (int r = 0; r < rounds.length; r++) {
      centerYs.add([
        for (int i = 0; i < rounds[r].length; i++) _matchCenterY(r, i, _kUnit),
      ]);
    }

    String? winnerName;
    if (rounds.isNotEmpty && rounds.last.isNotEmpty) {
      winnerName = _winnerName(rounds.last.first);
    }

    final lineColor = AppThemeTokens.border(context);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 16),
        child: SizedBox(
          width: canvasW + _kWinnerW,
          height: canvasH,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: CustomPaint(
                  painter: _BracketLinePainter(
                    rounds: rounds,
                    centerYs: centerYs,
                    lineColor: lineColor,
                  ),
                ),
              ),
              for (int r = 0; r < columns.length; r++)
                Positioned(
                  left: r * _kColW,
                  top: 0,
                  width: _kMatchW,
                  height: 28,
                  child: _BracketColumnHeader(label: columns[r].label),
                ),
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

class _BracketColumnHeader extends StatelessWidget {
  const _BracketColumnHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppThemeTokens.primary500.withOpacity(0.1),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppThemeTokens.primary500.withOpacity(0.2)),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppThemeTokens.primary500,
          ),
        ),
      ),
    );
  }
}

class _BracketLinePainter extends CustomPainter {
  const _BracketLinePainter({
    required this.rounds,
    required this.centerYs,
    required this.lineColor,
  });

  final List<List<_BracketCanvasMatch>> rounds;
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

        if (fi1 < currCount) {
          final y1 = centerYs[r][fi1];
          canvas.drawLine(
            Offset(r * _kColW + _kMatchW, y1),
            Offset(connX, y1),
            paint,
          );
        }

        if (fi2 < currCount) {
          final y2 = centerYs[r][fi2];
          canvas.drawLine(
            Offset(r * _kColW + _kMatchW, y2),
            Offset(connX, y2),
            paint,
          );

          if (fi1 < currCount) {
            canvas.drawLine(
              Offset(connX, centerYs[r][fi1]),
              Offset(connX, y2),
              paint,
            );
          }
        }

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
      old.lineColor != lineColor || old.rounds.length != rounds.length;
}

class _BracketMatchCard extends StatelessWidget {
  const _BracketMatchCard({required this.match, this.isFinal = false});

  final _BracketCanvasMatch match;
  final bool isFinal;

  @override
  Widget build(BuildContext context) {
    final hasScore = match.scoreA != null && match.scoreB != null;
    final aWins = hasScore && match.scoreA! > match.scoreB!;
    final bWins = hasScore && match.scoreB! > match.scoreA!;

    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.cardElevated(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color: isFinal ? _kAccentBracket.withOpacity(0.5) : AppThemeTokens.border(context),
          width: isFinal ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        children: [
          Expanded(
            child: _BracketTeamRow(
              name: match.teamAName,
              score: match.scoreA,
              isWinner: aWins,
            ),
          ),
          Divider(height: 1, color: AppThemeTokens.border(context)),
          Expanded(
            child: _BracketTeamRow(
              name: match.teamBName,
              score: match.scoreB,
              isWinner: bWins,
            ),
          ),
        ],
      ),
    );
  }
}

class _BracketTeamRow extends StatelessWidget {
  const _BracketTeamRow({required this.name, this.score, required this.isWinner});

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

class _ProjectedQualifier {
  const _ProjectedQualifier({
    required this.teamName,
    required this.points,
    required this.goalDifference,
    required this.goalsFor,
  });

  final String teamName;
  final int points;
  final int goalDifference;
  final int goalsFor;
}

List<TournamentMatchModel> _buildProjectedKnockoutMatches(TournamentModel tournament) {
  if (tournament.standings.isEmpty) return const [];

  final teamById = {for (final team in tournament.teams) team.id: team};
  final grouped = <String, List<TournamentStandingModel>>{};
  for (final standing in tournament.standings) {
    final poolName = teamById[standing.teamId]?.poolName;
    final key = standing.groupName ?? poolName ?? 'Group';
    grouped.putIfAbsent(key, () => []).add(standing);
  }

  final orderedGroups = grouped.keys.toList()..sort();
  final qualifiersByGroup = <String, List<_ProjectedQualifier>>{};
  for (final groupName in orderedGroups) {
    final ranked = [...grouped[groupName]!]..sort(_compareStandingsForProjection);
    qualifiersByGroup[groupName] = ranked
        .map((standing) => _ProjectedQualifier(
              teamName: standing.teamName,
              points: standing.points,
              goalDifference: standing.goalDifference,
              goalsFor: standing.goalsFor,
            ))
        .toList();
  }

  final rankedQualifiers = <_ProjectedQualifier>[];
  final maxPerGroup = qualifiersByGroup.values.fold<int>(
    0,
    (maxSoFar, rows) => rows.length > maxSoFar ? rows.length : maxSoFar,
  );
  for (int position = 0; position < maxPerGroup; position++) {
    for (final groupName in orderedGroups) {
      final rows = qualifiersByGroup[groupName]!;
      if (position < rows.length) {
        rankedQualifiers.add(rows[position]);
      }
    }
  }

  final qualifierCount = _projectedQualifierCount(rankedQualifiers.length);
  if (qualifierCount == 0) return const [];
  final seeded = rankedQualifiers.take(qualifierCount).toList()
    ..sort(_compareProjectedQualifier);

  final stage = _initialKnockoutStage(qualifierCount);
  if (stage == null) return const [];

  final projectedMatches = <TournamentMatchModel>[];
  for (int i = 0; i < qualifierCount ~/ 2; i++) {
    final seedA = seeded[i];
    final seedB = seeded[qualifierCount - 1 - i];
    projectedMatches.add(
      TournamentMatchModel(
        id: 'projected-${stage}-${i + 1}',
        tournamentId: tournament.id,
        round: _stageLabel(stage, useGroupsKnockoutLabels: true),
        status: 'scheduled',
        stage: stage,
        roundNumber: 1,
        matchOrder: i + 1,
        teamAName: seedA.teamName,
        teamBName: seedB.teamName,
      ),
    );
  }

  return projectedMatches;
}

int _projectedQualifierCount(int totalTeams) {
  if (totalTeams >= 16) return 16;
  if (totalTeams >= 8) return 8;
  if (totalTeams >= 4) return 4;
  return 0;
}

String? _initialKnockoutStage(int qualifierCount) {
  switch (qualifierCount) {
    case 16:
      return 'round_of_16';
    case 8:
      return 'quarter_finals';
    case 4:
      return 'semi_finals';
    default:
      return null;
  }
}

int _compareStandingsForProjection(
  TournamentStandingModel a,
  TournamentStandingModel b,
) {
  return _compareProjectionRank(
    pointsA: a.points,
    pointsB: b.points,
    goalDifferenceA: a.goalDifference,
    goalDifferenceB: b.goalDifference,
    goalsForA: a.goalsFor,
    goalsForB: b.goalsFor,
    teamNameA: a.teamName,
    teamNameB: b.teamName,
  );
}

int _compareProjectedQualifier(
  _ProjectedQualifier a,
  _ProjectedQualifier b,
) {
  return _compareProjectionRank(
    pointsA: a.points,
    pointsB: b.points,
    goalDifferenceA: a.goalDifference,
    goalDifferenceB: b.goalDifference,
    goalsForA: a.goalsFor,
    goalsForB: b.goalsFor,
    teamNameA: a.teamName,
    teamNameB: b.teamName,
  );
}

int _compareProjectionRank({
  required int pointsA,
  required int pointsB,
  required int goalDifferenceA,
  required int goalDifferenceB,
  required int goalsForA,
  required int goalsForB,
  required String teamNameA,
  required String teamNameB,
}) {
  final pointsDiff = pointsB.compareTo(pointsA);
  if (pointsDiff != 0) return pointsDiff;
  final gdDiff = goalDifferenceB.compareTo(goalDifferenceA);
  if (gdDiff != 0) return gdDiff;
  final gfDiff = goalsForB.compareTo(goalsForA);
  if (gfDiff != 0) return gfDiff;
  return teamNameA.compareTo(teamNameB);
}
