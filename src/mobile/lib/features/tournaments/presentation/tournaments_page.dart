import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/models/tournament_model.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/tournament_repository_impl.dart';
import '../state/tournaments_notifier.dart';

class TournamentsPage extends ConsumerStatefulWidget {
  const TournamentsPage({super.key});

  @override
  ConsumerState<TournamentsPage> createState() => _TournamentsPageState();
}

class _TournamentsPageState extends ConsumerState<TournamentsPage> {
  @override
  Widget build(BuildContext context) {
    final tournamentsAsync = ref.watch(tournamentsNotifierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tournaments')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/tournaments/create'),
        tooltip: 'Create tournament',
        child: const Icon(Icons.add),
      ),
      body: tournamentsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref.read(tournamentsNotifierProvider.notifier).load(),
        ),
        data: (tournaments) {
          if (tournaments.isEmpty) {
            return const UiEmptyState(
              icon: Icons.emoji_events_outlined,
              message: 'No tournaments yet.',
            );
          }

          return RefreshIndicator(
            onRefresh: () =>
                ref.read(tournamentsNotifierProvider.notifier).load(),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
              itemCount: tournaments.length,
              itemBuilder: (ctx, i) {
                final t = tournaments[i];
                return _TournamentCard(
                  tournament: t,
                  onTap: () => context.push('/tournaments/${t.id}'),
                );
              },
            ),
          );
        },
      ),
    );
  }

}

// ---------------------------------------------------------------------------
// Tournament list card
// ---------------------------------------------------------------------------

class _TournamentCard extends StatelessWidget {
  const _TournamentCard({required this.tournament, required this.onTap});

  final TournamentModel tournament;
  final VoidCallback onTap;

  static const _accentColor = Color(0xFFFF9800);

  String _formatStatus(String s) {
    const m = {
      'draft': 'Draft',
      'registration': 'Registration',
      'active': 'Active',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return m[s] ?? s;
  }

  @override
  Widget build(BuildContext context) {
    final t = tournament;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: AppThemeTokens.card(context),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.border(context)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Left accent bar
            Container(
              width: 4,
              decoration: const BoxDecoration(
                color: _accentColor,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(AppThemeTokens.radiusMd),
                  bottomLeft: Radius.circular(AppThemeTokens.radiusMd),
                ),
              ),
            ),
            // Trophy icon
            Container(
              margin: const EdgeInsets.all(12),
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFFF9800), Color(0xFFE65100)],
                ),
                borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
              ),
              child: const Icon(Icons.emoji_events_outlined,
                  color: Colors.white, size: 22),
            ),
            // Content
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name + status badge
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            t.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        UiStatusBadge(
                          label: _formatStatus(t.status),
                          status: UiStatusBadge.fromString(t.status),
                          dot: true,
                        ),
                        const SizedBox(width: 10),
                      ],
                    ),
                    const SizedBox(height: 6),
                    // Sport + teams + date
                    Wrap(
                      spacing: 10,
                      runSpacing: 3,
                      children: [
                        if (t.sportType.isNotEmpty)
                          _TournamentMeta(
                            icon: Icons.sports_outlined,
                            label: sportTypeLabel(t.sportType),
                            color: _accentColor,
                          ),
                        _TournamentMeta(
                          icon: Icons.group_outlined,
                          label:
                              '${t.teamCount} team${t.teamCount == 1 ? '' : 's'}',
                          color: AppThemeTokens.primary400,
                        ),
                        if (t.startDate != null)
                          _TournamentMeta(
                            icon: Icons.calendar_today_outlined,
                            label: DateFormat('MMM d, y')
                                .format(t.startDate!.toLocal()),
                            color: AppThemeTokens.textSecondary(context),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            // Chevron
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Icon(Icons.chevron_right_rounded,
                  color: AppThemeTokens.textMuted(context), size: 20),
            ),
          ],
        ),
      ),
    );
  }
}

class _TournamentMeta extends StatelessWidget {
  const _TournamentMeta(
      {required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color.withValues(alpha: 0.8)),
        const SizedBox(width: 3),
        Text(
          label,
          style: TextStyle(
              color: color.withValues(alpha: 0.8),
              fontSize: 11,
              fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Tournament detail page
// ---------------------------------------------------------------------------

class TournamentDetailPage extends ConsumerWidget {
  const TournamentDetailPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tournamentAsync = ref.watch(tournamentDetailProvider(tournamentId));
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: tournamentAsync.maybeWhen(
          data: (t) => Text(t.name),
          orElse: () => const Text('Tournament'),
        ),
      ),
      body: tournamentAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () =>
              ref.invalidate(tournamentDetailProvider(tournamentId)),
        ),
        data: (t) => DefaultTabController(
          length: 3,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Header ──────────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: AppThemeTokens.heroGrad(context),
                  border: Border(
                    bottom: BorderSide(color: AppThemeTokens.border(context)),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Icon + title row
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                Color(0xFFFF9800),
                                Color(0xFFE65100),
                              ],
                            ),
                            borderRadius: BorderRadius.circular(
                                AppThemeTokens.radiusMd),
                          ),
                          child: const Icon(Icons.emoji_events_outlined,
                              color: Colors.white, size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                t.name,
                                style: theme.textTheme.titleLarge,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              UiStatusBadge(
                                label: _statusLabel(t.status),
                                status: UiStatusBadge.fromString(t.status),
                                dot: true,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    // Badges row
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        if (t.sportType.isNotEmpty)
                          UiStatusBadge(
                            label: sportTypeLabel(t.sportType),
                            customColor: const Color(0xFFFF9800),
                          ),
                        UiStatusBadge(
                          label: _formatLabel(t.format),
                          status: UiStatusType.info,
                        ),
                        UiStatusBadge(
                          label:
                              '${t.teamCount} team${t.teamCount == 1 ? '' : 's'}${t.maxTeams != null ? ' / ${t.maxTeams} max' : ''}',
                          status: UiStatusType.defaultStatus,
                        ),
                      ],
                    ),
                    if (t.description != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        t.description!,
                        style: TextStyle(
                          color: AppThemeTokens.textSecondary(context),
                          fontSize: 13,
                          height: 1.5,
                        ),
                      ),
                    ],
                    if (t.startDate != null) ...[
                      const SizedBox(height: 10),
                      UiInfoRow(
                        icon: Icons.calendar_today_outlined,
                        label: 'Starts',
                        value: DateFormat.yMMMd()
                            .format(t.startDate!.toLocal()),
                        iconColor: AppThemeTokens.info,
                      ),
                    ],
                  ],
                ),
              ),
              // ── Tab bar ─────────────────────────────────────────────
              Container(
                decoration: BoxDecoration(
                  color: AppThemeTokens.bg(context),
                  border: Border(
                    bottom: BorderSide(color: AppThemeTokens.border(context)),
                  ),
                ),
                child: const TabBar(
                  tabs: [
                    Tab(text: 'Teams'),
                    Tab(text: 'Matches'),
                    Tab(text: 'Standings'),
                  ],
                ),
              ),
              // ── Tab content ─────────────────────────────────────────
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(tournamentDetailProvider(tournamentId)),
                  notificationPredicate: (n) => n.depth == 1,
                  child: TabBarView(
                    children: [
                      _TeamsTab(teams: t.teams, format: t.format),
                      _MatchesTab(matches: t.matches),
                      _StandingsTab(teams: t.teams, format: t.format),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _statusLabel(String s) {
    const m = {
      'draft': 'Draft',
      'registration': 'Registration',
      'active': 'Active',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return m[s] ?? s;
  }

  String _formatLabel(String f) {
    const m = {
      'bracket': 'Bracket',
      'pool': 'Pool',
      'round_robin': 'Round Robin',
      'single_elimination': 'Single Elimination',
      'double_elimination': 'Double Elimination',
      'groups_knockout': 'Groups + Knockout',
    };
    return m[f] ?? f;
  }
}

class _TeamsTab extends StatelessWidget {
  const _TeamsTab({required this.teams, required this.format});
  final List<TournamentTeamModel> teams;
  final String format;

  @override
  Widget build(BuildContext context) {
    if (teams.isEmpty) {
      return const UiEmptyState(
        icon: Icons.group_outlined,
        title: 'No teams yet',
        message: 'No teams have registered for this tournament yet.',
      );
    }

    final hasPools = format == 'pool' && teams.any((t) => t.poolId != null);

    if (hasPools) {
      final pools = <String, List<TournamentTeamModel>>{};
      for (final team in teams) {
        final poolKey = team.poolId ?? 'No Pool';
        pools.putIfAbsent(poolKey, () => []).add(team);
      }
      return ListView(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        children: pools.entries.map((entry) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8, top: 4),
                child: UiSectionTitle('Pool ${entry.key}'),
              ),
              ...entry.value.asMap().entries.map((e) => _TeamRow(
                    rank: e.key + 1,
                    team: e.value,
                    isLast: e.key == entry.value.length - 1,
                  )),
              const SizedBox(height: 12),
            ],
          );
        }).toList(),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      itemCount: teams.length,
      itemBuilder: (ctx, i) => _TeamRow(
        rank: i + 1,
        team: teams[i],
        isLast: i == teams.length - 1,
      ),
    );
  }
}

class _TeamRow extends StatelessWidget {
  const _TeamRow({required this.rank, required this.team, this.isLast = false});
  final int rank;
  final TournamentTeamModel team;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final hasRecord = team.wins + team.losses > 0;
    return Container(
      margin: EdgeInsets.only(bottom: isLast ? 0 : 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppThemeTokens.cardElevated(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      child: Row(
        children: [
          // Rank
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: AppThemeTokens.card(context),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
              border: Border.all(color: AppThemeTokens.border(context)),
            ),
            alignment: Alignment.center,
            child: Text(
              '$rank',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppThemeTokens.textSecondary(context)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              team.name,
              style: TextStyle(
                  color: AppThemeTokens.text(context),
                  fontSize: 14,
                  fontWeight: FontWeight.w500),
            ),
          ),
          if (hasRecord) ...[
            UiStatusBadge(
              label: '${team.wins}W',
              status: UiStatusType.success,
            ),
            const SizedBox(width: 6),
            UiStatusBadge(
              label: '${team.losses}L',
              status: UiStatusType.error,
            ),
          ],
        ],
      ),
    );
  }
}

class _StandingsTab extends StatelessWidget {
  const _StandingsTab({required this.teams, required this.format});
  final List<TournamentTeamModel> teams;
  final String format;

  static const _goldColor = Color(0xFFFFD700);
  static const _silverColor = Color(0xFFC0C0C0);
  static const _bronzeColor = Color(0xFFCD7F32);

  @override
  Widget build(BuildContext context) {
    if (teams.isEmpty) {
      return const UiEmptyState(
        icon: Icons.leaderboard_outlined,
        title: 'No standings yet',
        message: 'Standings will appear once matches are played.',
      );
    }

    final hasStats = teams.any((t) => t.wins + t.losses > 0);

    if (!hasStats) {
      return const UiEmptyState(
        icon: Icons.leaderboard_outlined,
        title: 'No stats yet',
        message: 'Standings will be available once matches are played.',
      );
    }

    final sorted = [...teams]
      ..sort((a, b) {
        final ptsDiff = b.points.compareTo(a.points);
        if (ptsDiff != 0) return ptsDiff;
        return b.wins.compareTo(a.wins);
      });

    return ListView.builder(
      itemCount: sorted.length + 1,
      itemBuilder: (ctx, i) {
        // Item 0 is the column header row
        if (i == 0) {
          return Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: AppThemeTokens.cardElevated(context),
              border: Border(
                bottom: BorderSide(color: AppThemeTokens.border(context)),
              ),
            ),
            child: Row(
              children: [
                const SizedBox(width: 42),
                Expanded(
                  child: Text(
                    'TEAM',
                    style: TextStyle(
                      color: AppThemeTokens.textMuted(context),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
                const SizedBox(
                  width: 40,
                  child: Text(
                    'W',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppThemeTokens.success,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                const SizedBox(
                  width: 40,
                  child: Text(
                    'L',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppThemeTokens.error,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                const SizedBox(
                  width: 44,
                  child: Text(
                    'PTS',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppThemeTokens.primary400,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
          );
        }

        final team = sorted[i - 1];
        final Color rowBg;
        final Color rankColor;
        Widget rankWidget;

        if (i == 1) {
          rowBg = _goldColor.withValues(alpha: 0.07);
          rankColor = _goldColor;
          rankWidget = const Text('🥇', style: TextStyle(fontSize: 18));
        } else if (i == 2) {
          rowBg = _silverColor.withValues(alpha: 0.06);
          rankColor = _silverColor;
          rankWidget = const Text('🥈', style: TextStyle(fontSize: 18));
        } else if (i == 3) {
          rowBg = _bronzeColor.withValues(alpha: 0.06);
          rankColor = _bronzeColor;
          rankWidget = const Text('🥉', style: TextStyle(fontSize: 18));
        } else {
          rowBg = i.isEven
              ? AppThemeTokens.card(context)
              : AppThemeTokens.cardElevated(context);
          rankColor = AppThemeTokens.textMuted(context);
          rankWidget = Text(
            '$i',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: rankColor,
            ),
          );
        }

        return Container(
          decoration: BoxDecoration(
            color: rowBg,
            border: Border(
              bottom: BorderSide(
                  color: AppThemeTokens.border(context), width: 0.5),
            ),
          ),
          padding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              SizedBox(
                width: 32,
                child: Center(child: rankWidget),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  team.name,
                  style: TextStyle(
                    fontWeight:
                        i <= 3 ? FontWeight.w700 : FontWeight.w500,
                    fontSize: 13,
                    color: AppThemeTokens.text(context),
                  ),
                ),
              ),
              SizedBox(
                width: 40,
                child: Text(
                  '${team.wins}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppThemeTokens.success,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
              SizedBox(
                width: 40,
                child: Text(
                  '${team.losses}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppThemeTokens.error,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
              SizedBox(
                width: 44,
                child: Text(
                  '${team.points}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppThemeTokens.primary400,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _MatchesTab extends StatelessWidget {
  const _MatchesTab({required this.matches});
  final List<TournamentMatchModel> matches;

  @override
  Widget build(BuildContext context) {
    if (matches.isEmpty) {
      return const UiEmptyState(
        icon: Icons.sports_score_outlined,
        title: 'No matches yet',
        message: 'No matches have been scheduled yet.',
      );
    }

    // Group by round
    final rounds = <String, List<TournamentMatchModel>>{};
    for (final m in matches) {
      rounds.putIfAbsent(m.round, () => []).add(m);
    }

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      children: rounds.entries.map((entry) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8, top: 4),
              child: UiSectionTitle(entry.key),
            ),
            ...entry.value.map((m) => _MatchTile(match: m)),
            const SizedBox(height: 8),
          ],
        );
      }).toList(),
    );
  }
}

class _MatchTile extends StatelessWidget {
  const _MatchTile({required this.match});
  final TournamentMatchModel match;

  @override
  Widget build(BuildContext context) {
    final teamA = match.teamAName ?? 'TBD';
    final teamB = match.teamBName ?? 'TBD';
    final hasScore = match.scoreA != null && match.scoreB != null;
    final aWins = hasScore && match.scoreA! > match.scoreB!;
    final bWins = hasScore && match.scoreB! > match.scoreA!;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppThemeTokens.cardElevated(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      child: Row(
        children: [
          // Team A
          Expanded(
            child: Text(
              teamA,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: aWins ? FontWeight.w700 : FontWeight.w500,
                color: aWins
                    ? AppThemeTokens.success
                    : AppThemeTokens.text(context),
                fontSize: 13,
              ),
            ),
          ),
          // Score / vs
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 14),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppThemeTokens.card(context),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
              border: Border.all(
                color: AppThemeTokens.border(context),
              ),
            ),
            child: Text(
              hasScore ? '${match.scoreA}  –  ${match.scoreB}' : 'vs',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: hasScore
                    ? AppThemeTokens.text(context)
                    : AppThemeTokens.textMuted(context),
                letterSpacing: 1,
              ),
            ),
          ),
          // Team B
          Expanded(
            child: Text(
              teamB,
              style: TextStyle(
                fontWeight: bWins ? FontWeight.w700 : FontWeight.w500,
                color: bWins
                    ? AppThemeTokens.success
                    : AppThemeTokens.text(context),
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Create Tournament page
// ---------------------------------------------------------------------------

class CreateTournamentPage extends ConsumerStatefulWidget {
  const CreateTournamentPage({super.key});

  @override
  ConsumerState<CreateTournamentPage> createState() =>
      _CreateTournamentPageState();
}

class _CreateTournamentPageState extends ConsumerState<CreateTournamentPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _maxTeamsCtrl = TextEditingController();

  String _sportType = '';
  String _format = 'bracket';
  DateTime? _startDate;
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _maxTeamsCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickStartDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _startDate ?? DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (d != null) setState(() => _startDate = d);
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      final t = await ref.read(tournamentRepositoryProvider).createTournament({
        'name': _nameCtrl.text.trim(),
        if (_sportType.isNotEmpty) 'sportType': _sportType,
        'format': _format,
        if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
        if (_maxTeamsCtrl.text.trim().isNotEmpty)
          'maxTeams': int.tryParse(_maxTeamsCtrl.text.trim()),
        if (_startDate != null) 'startDate': _startDate!.toIso8601String(),
      });
      ref.read(tournamentsNotifierProvider.notifier).load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tournament created!')),
        );
        context.go('/tournaments/${t.id}');
      }
    } on Exception catch (e) {
      if (mounted) {
        final msg = e is AppException
            ? e.message
            : e.toString().replaceFirst('Exception: ', '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Tournament')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Tournament name *',
                prefixIcon: Icon(Icons.emoji_events_outlined),
              ),
              textCapitalization: TextCapitalization.words,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 16),

            DropdownButtonFormField<String>(
              key: ValueKey(_sportType),
              initialValue: _sportType,
              decoration: const InputDecoration(
                labelText: 'Sport type',
                prefixIcon: Icon(Icons.sports_outlined),
              ),
              dropdownColor: AppThemeTokens.cardElevated(context),
              items: kSportTypes
                  .map(
                    (s) => DropdownMenuItem(
                      value: s['value'],
                      child: Text(s['label']!),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _sportType = v ?? ''),
            ),
            const SizedBox(height: 16),

            DropdownButtonFormField<String>(
              key: ValueKey(_format),
              initialValue: _format,
              decoration: const InputDecoration(
                labelText: 'Format',
                prefixIcon: Icon(Icons.account_tree_outlined),
              ),
              dropdownColor: AppThemeTokens.cardElevated(context),
                  .map(
                    (f) => DropdownMenuItem(
                      value: f['value'],
                      child: Text(f['label']!),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _format = v ?? 'bracket'),
            ),
            const SizedBox(height: 16),

            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description (optional)',
                prefixIcon: Icon(Icons.notes_outlined),
                alignLabelWithHint: true,
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 16),

            TextFormField(
              controller: _maxTeamsCtrl,
              decoration: const InputDecoration(
                labelText: 'Max teams (optional)',
                prefixIcon: Icon(Icons.group_outlined),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),

            InkWell(
              onTap: _pickStartDate,
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Start date (optional)',
                  prefixIcon: Icon(Icons.calendar_today_outlined),
                ),
                child: Text(
                  _startDate != null
                      ? DateFormat.yMMMd().format(_startDate!)
                      : 'Tap to select',
                  style: TextStyle(
                    color: _startDate == null
                        ? AppThemeTokens.textSecondary(context)
                        : AppThemeTokens.text(context),
                    fontSize: 14,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 28),

            UiPrimaryButton(
              text: 'Create Tournament',
              icon: Icons.add_circle_outline,
              onPressed: _saving ? null : _submit,
              loading: _saving,
            ),
          ],
        ),
      ),
    );
  }
}

