import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/models/league_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/league_repository_impl.dart';
import '../state/leagues_notifier.dart';

const _kAccentColor = Color(0xFF8B5CF6);

class LeagueDetailPage extends ConsumerStatefulWidget {
  const LeagueDetailPage({super.key, required this.leagueId});

  final String leagueId;

  @override
  ConsumerState<LeagueDetailPage> createState() => _LeagueDetailPageState();
}

class _LeagueDetailPageState extends ConsumerState<LeagueDetailPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final leagueAsync = ref.watch(leagueDetailProvider(widget.leagueId));

    return Scaffold(
      body: leagueAsync.when(
        loading: () => const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
        error: (err, _) => Scaffold(
          appBar: AppBar(title: const Text('League')),
          body: ErrorDisplay(
            message: err.toString(),
            onRetry: () => ref.invalidate(leagueDetailProvider(widget.leagueId)),
          ),
        ),
        data: (league) => _LeagueDetailContent(
          league: league,
          tabController: _tabController,
          onRefresh: () =>
              ref.invalidate(leagueDetailProvider(widget.leagueId)),
        ),
      ),
    );
  }
}

// ── Detail content ─────────────────────────────────────────────────────────────

class _LeagueDetailContent extends ConsumerWidget {
  const _LeagueDetailContent({
    required this.league,
    required this.tabController,
    required this.onRefresh,
  });

  final LeagueModel league;
  final TabController tabController;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return NestedScrollView(
      headerSliverBuilder: (context, _) => [
        SliverAppBar(
          expandedHeight: 200,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            title: Text(
              league.name,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
            background: league.coverImage != null
                ? Image.network(league.coverImage!, fit: BoxFit.cover)
                : Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFF4C1D95), Color(0xFF1E1B4B)],
                      ),
                    ),
                    child: const Center(
                      child: Icon(Icons.military_tech_rounded,
                          color: Colors.white54, size: 64),
                    ),
                  ),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: onRefresh,
            ),
          ],
        ),
        SliverToBoxAdapter(
          child: _HeaderSection(league: league, onRefresh: onRefresh),
        ),
        SliverPersistentHeader(
          pinned: true,
          delegate: _TabBarDelegate(
            TabBar(
              controller: tabController,
              indicatorColor: _kAccentColor,
              labelColor: _kAccentColor,
              unselectedLabelColor: AppThemeTokens.darkTextSecondary,
              indicatorSize: TabBarIndicatorSize.label,
              tabs: const [
                Tab(text: 'Overview'),
                Tab(text: 'Standings'),
                Tab(text: 'Teams'),
              ],
            ),
          ),
        ),
      ],
      body: TabBarView(
        controller: tabController,
        children: [
          _OverviewTab(league: league),
          _StandingsTab(leagueId: league.id),
          _TeamsTab(league: league, onRefresh: onRefresh),
        ],
      ),
    );
  }
}

// ── Header section ─────────────────────────────────────────────────────────────

class _HeaderSection extends ConsumerWidget {
  const _HeaderSection({required this.league, required this.onRefresh});

  final LeagueModel league;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textSecondary =
        isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;

    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Stat row
          Row(
            children: [
              _StatPill(
                icon: Icons.groups_outlined,
                label: '${league.memberCount} teams',
                color: _kAccentColor,
              ),
              const SizedBox(width: 8),
              _StatPill(
                icon: Icons.sports_soccer_outlined,
                label: league.sport,
                color: AppThemeTokens.info,
              ),
              const SizedBox(width: 8),
              _StatPill(
                icon: league.scheduleType == LeagueScheduleType.sessions
                    ? Icons.format_list_numbered
                    : Icons.calendar_today_outlined,
                label: league.scheduleType == LeagueScheduleType.sessions
                    ? 'Sessions'
                    : 'Duration',
                color: AppThemeTokens.warning,
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Progress bar
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Progress',
                            style: TextStyle(
                                fontSize: 12,
                                color: textSecondary,
                                fontFamily: 'Inter')),
                        Text(
                          league.progressLabel,
                          style: const TextStyle(
                              fontSize: 12,
                              color: _kAccentColor,
                              fontFamily: 'Inter',
                              fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(100),
                      child: LinearProgressIndicator(
                        value: league.progress,
                        minHeight: 6,
                        backgroundColor:
                            _kAccentColor.withValues(alpha: 0.15),
                        valueColor:
                            const AlwaysStoppedAnimation<Color>(_kAccentColor),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Join button
          UiPrimaryButton(
            text: 'Join League',
            icon: Icons.group_add_outlined,
            onPressed: () async {
              try {
                await ref
                    .read(leaguesNotifierProvider.notifier)
                    .joinLeague(league.id);
                onRefresh();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Joined league!')),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: $e')),
                  );
                }
              }
            },
          ),
        ],
      ),
    );
  }
}

// ── Overview tab ───────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.league});
  final LeagueModel league;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('d MMM yyyy');
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textSecondary =
        isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (league.description != null) ...[
          UiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const UiSectionTitle(title: 'About'),
                const SizedBox(height: 8),
                Text(league.description!,
                    style: TextStyle(color: textSecondary, fontFamily: 'Inter')),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        UiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const UiSectionTitle(title: 'Details'),
              const SizedBox(height: 8),
              UiInfoRow(
                icon: Icons.calendar_today_outlined,
                label: 'Start Date',
                value: league.startDate != null
                    ? fmt.format(league.startDate!)
                    : '—',
              ),
              if (league.endDate != null)
                UiInfoRow(
                  icon: Icons.event_busy_outlined,
                  label: 'End Date',
                  value: fmt.format(league.endDate!),
                ),
              if (league.sessionCount != null)
                UiInfoRow(
                  icon: Icons.format_list_numbered,
                  label: 'Planned Sessions',
                  value: '${league.sessionCount}',
                ),
              if (league.maxTeams != null)
                UiInfoRow(
                  icon: Icons.group_work_outlined,
                  label: 'Max Teams',
                  value: '${league.maxTeams}',
                ),
              if (league.location != null)
                UiInfoRow(
                  icon: Icons.location_on_outlined,
                  label: 'Location',
                  value: league.location!,
                ),
              UiInfoRow(
                icon: Icons.lock_outline,
                label: 'Visibility',
                value: league.isPublic ? 'Public' : 'Private',
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Standings tab ───────────────────────────────────────────────────────────────

class _StandingsTab extends ConsumerWidget {
  const _StandingsTab({required this.leagueId});
  final String leagueId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final standingsAsync = ref.watch(leagueStandingsProvider(leagueId));

    return standingsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorDisplay(
        message: e.toString(),
        onRetry: () => ref.invalidate(leagueStandingsProvider(leagueId)),
      ),
      data: (standings) {
        if (standings.isEmpty) {
          return const UiEmptyState(
            icon: Icons.leaderboard_outlined,
            message: 'No standings yet. Record match results to populate.',
          );
        }

        return ListView(
          padding: const EdgeInsets.all(12),
          children: [
            _StandingsTable(standings: standings),
          ],
        );
      },
    );
  }
}

class _StandingsTable extends StatelessWidget {
  const _StandingsTable({required this.standings});
  final List<LeagueStandingModel> standings;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final border = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final headerBg = isDark ? AppThemeTokens.darkCardElevated : AppThemeTokens.lightCardElevated;
    final cardBg = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
    final textSecondary = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;

    const cols = ['#', 'Team', 'P', 'W', 'D', 'L', 'GD', 'Pts'];
    const flex = [1, 5, 1, 1, 1, 1, 2, 2];

    return Container(
      decoration: BoxDecoration(
        color: cardBg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: headerBg,
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppThemeTokens.radiusMd)),
            ),
            child: Row(
              children: [
                for (int i = 0; i < cols.length; i++)
                  Expanded(
                    flex: flex[i],
                    child: Text(
                      cols[i],
                      textAlign: i == 1 ? TextAlign.left : TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: textSecondary,
                        fontFamily: 'Inter',
                      ),
                    ),
                  ),
              ],
            ),
          ),
          // Rows
          for (int i = 0; i < standings.length; i++) ...[
            if (i > 0)
              Divider(height: 1, thickness: 1, color: border.withValues(alpha: 0.5)),
            _StandingRow(index: i, standing: standings[i], flex: flex),
          ],
        ],
      ),
    );
  }
}

class _StandingRow extends StatelessWidget {
  const _StandingRow(
      {required this.index, required this.standing, required this.flex});
  final int index;
  final LeagueStandingModel standing;
  final List<int> flex;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final values = [
      '${index + 1}',
      standing.teamName,
      '${standing.played}',
      '${standing.won}',
      '${standing.drawn}',
      '${standing.lost}',
      standing.goalDifference >= 0
          ? '+${standing.goalDifference}'
          : '${standing.goalDifference}',
      '${standing.points}',
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          for (int i = 0; i < values.length; i++)
            Expanded(
              flex: flex[i],
              child: Text(
                values[i],
                textAlign: i == 1 ? TextAlign.left : TextAlign.center,
                overflow: i == 1 ? TextOverflow.ellipsis : null,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: i == 7 ? FontWeight.w700 : FontWeight.w500,
                  color: i == 7
                      ? _kAccentColor
                      : (isDark
                          ? AppThemeTokens.darkText
                          : AppThemeTokens.lightText),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Teams tab ──────────────────────────────────────────────────────────────────

class _TeamsTab extends ConsumerStatefulWidget {
  const _TeamsTab({required this.league, required this.onRefresh});
  final LeagueModel league;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_TeamsTab> createState() => _TeamsTabState();
}

class _TeamsTabState extends ConsumerState<_TeamsTab> {
  Future<void> _showAddTeamDialog() async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Team'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Team Name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Add'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (ok != true) return;
    try {
      await ref
          .read(leagueRepositoryProvider)
          .addTeam(widget.league.id, ctrl.text.trim());
      widget.onRefresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Future<void> _removeTeam(String teamId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Team'),
        content: const Text('Are you sure you want to remove this team?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Remove')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref
          .read(leagueRepositoryProvider)
          .removeTeam(widget.league.id, teamId);
      widget.onRefresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final teams = widget.league.teams;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Add team button (admin action)
        UiPrimaryButton(
          text: 'Add Team',
          icon: Icons.group_add_outlined,
          onPressed: _showAddTeamDialog,
        ),
        const SizedBox(height: 16),

        if (teams.isEmpty)
          const UiEmptyState(
            icon: Icons.groups_2_outlined,
            message: 'No teams yet. Add the first team above.',
          )
        else
          for (final team in teams) ...[
            _TeamTile(
              team: team,
              onRemove: () => _removeTeam(team.id),
            ),
            const SizedBox(height: 8),
          ],
      ],
    );
  }
}

class _TeamTile extends StatelessWidget {
  const _TeamTile({required this.team, required this.onRemove});
  final LeagueTeamModel team;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard,
        border: Border.all(
            color: isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: _kAccentColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.shield_outlined,
                color: _kAccentColor, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  team.name,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                if (team.players.isNotEmpty)
                  Text(
                    '${team.players.length} player${team.players.length == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: AppThemeTokens.darkTextSecondary,
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.remove_circle_outline, color: AppThemeTokens.error),
            onPressed: onRemove,
            tooltip: 'Remove team',
          ),
        ],
      ),
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

class _StatPill extends StatelessWidget {
  const _StatPill({required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(
                  fontSize: 12,
                  color: color,
                  fontFamily: 'Inter',
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  const _TabBarDelegate(this.tabBar);
  final TabBar tabBar;

  @override
  double get minExtent => tabBar.preferredSize.height;
  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_TabBarDelegate oldDelegate) =>
      tabBar != oldDelegate.tabBar;
}
