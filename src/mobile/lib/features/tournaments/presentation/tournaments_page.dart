import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/error_utils.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/tournament_repository_impl.dart';
import '../state/tournaments_notifier.dart';

const _kAccent = Color(0xFFFF9800);

// ===========================================================================
// Tournaments List Page
// ===========================================================================

class TournamentsPage extends ConsumerStatefulWidget {
  const TournamentsPage({super.key});

  @override
  ConsumerState<TournamentsPage> createState() => _TournamentsPageState();
}

class _TournamentsPageState extends ConsumerState<TournamentsPage> {
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';
  String? _statusFilter;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tournamentsAsync = ref.watch(tournamentsNotifierProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tournaments'),
        actions: [
          IconButton(
            icon: const Icon(Icons.mail_outline),
            tooltip: 'My Invitations',
            onPressed: () => context.push('/tournaments/invitations'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/tournaments/create'),
        tooltip: 'Create tournament',
        child: const Icon(Icons.add),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search tournaments…',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 20),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
              onChanged: (v) => setState(() => _searchQuery = v),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                for (final s in [
                  null,
                  'draft',
                  'registration',
                  'in_progress',
                  'completed',
                  'cancelled'
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: FilterChip(
                      label: Text(s == null ? 'All' : _formatStatus(s)),
                      selected: _statusFilter == s,
                      onSelected: (_) => setState(() => _statusFilter = s),
                    ),
                  ),
              ]),
            ),
          ),
          Expanded(
            child: tournamentsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorDisplay(
                message: extractErrorMessage(e),
                onRetry: () =>
                    ref.read(tournamentsNotifierProvider.notifier).reload(),
              ),
              data: (all) {
                final tournaments = all.where((t) {
                  if (_statusFilter != null && t.status != _statusFilter)
                    return false;
                  if (_searchQuery.isNotEmpty &&
                      !t.name
                          .toLowerCase()
                          .contains(_searchQuery.toLowerCase())) return false;
                  return true;
                }).toList();
                if (tournaments.isEmpty) {
                  return const UiEmptyState(
                    icon: Icons.emoji_events_outlined,
                    message: 'No tournaments found.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () =>
                      ref.read(tournamentsNotifierProvider.notifier).reload(),
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(
                        vertical: 12, horizontal: 16),
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
          ),
        ],
      ),
    );
  }

  String _formatStatus(String s) {
    const m = {
      'draft': 'Draft',
      'registration': 'Registration',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return m[s] ?? s;
  }
}

// ---------------------------------------------------------------------------
// Tournament list card
// ---------------------------------------------------------------------------

class _TournamentCard extends StatelessWidget {
  const _TournamentCard({required this.tournament, required this.onTap});

  final TournamentModel tournament;
  final VoidCallback onTap;

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

  Color _statusColor(String s) {
    switch (s) {
      case 'registration':
        return Colors.green;
      case 'in_progress':
      case 'active':
        return Colors.blue;
      case 'completed':
        return Colors.grey;
      case 'cancelled':
        return Colors.red;
      default:
        return _kAccent;
    }
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
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      t.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _statusColor(t.status).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _formatStatus(t.status),
                      style: TextStyle(
                          color: _statusColor(t.status),
                          fontSize: 11,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              if (t.description != null) ...[
                const SizedBox(height: 4),
                Text(
                  t.description!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      color: AppThemeTokens.textSecondary(context),
                      fontSize: 13),
                ),
              ],
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.sports_outlined,
                      size: 14, color: AppThemeTokens.textMuted(context)),
                  const SizedBox(width: 4),
                  Text(t.sportType,
                      style: TextStyle(
                          color: AppThemeTokens.textMuted(context),
                          fontSize: 12)),
                  const SizedBox(width: 12),
                  Icon(Icons.people_outline,
                      size: 14, color: AppThemeTokens.textMuted(context)),
                  const SizedBox(width: 4),
                  Text(
                    '${t.teamCount} teams',
                    style: TextStyle(
                        color: AppThemeTokens.textMuted(context), fontSize: 12),
                  ),
                  if (t.startDate != null) ...[
                    const SizedBox(width: 12),
                    Icon(Icons.calendar_today_outlined,
                        size: 14, color: AppThemeTokens.textMuted(context)),
                    const SizedBox(width: 4),
                    Text(
                      DateFormat.yMMMd().format(t.startDate!.toLocal()),
                      style: TextStyle(
                          color: AppThemeTokens.textMuted(context),
                          fontSize: 12),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ===========================================================================
// Tournament Detail Page
// ===========================================================================

class TournamentDetailPage extends ConsumerStatefulWidget {
  const TournamentDetailPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  ConsumerState<TournamentDetailPage> createState() =>
      _TournamentDetailPageState();
}

class _TournamentDetailPageState extends ConsumerState<TournamentDetailPage>
    with TickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 1, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tournamentAsync =
        ref.watch(tournamentDetailProvider(widget.tournamentId));
    final authState = ref.watch(authNotifierProvider);
    final currentUserId = authState.user?.id;

    return tournamentAsync.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Tournament')),
        body: ErrorDisplay(
          message: extractErrorMessage(e),
          onRetry: () =>
              ref.invalidate(tournamentDetailProvider(widget.tournamentId)),
        ),
      ),
      data: (t) {
        final isStarted = t.status == 'in_progress' ||
            t.status == 'active' ||
            t.status == 'completed';
        final isOrganizer = t.creatorId == currentUserId;
        final isAdmin =
            isOrganizer || t.admins.any((a) => a.userId == currentUserId);
        TournamentTeamModel? myTeam;
        if (currentUserId != null) {
          try {
            myTeam = t.teams.firstWhere(
              (team) =>
                  team.captainUserId == currentUserId ||
                  team.players
                      .any((p) => (p['userId'] as String?) == currentUserId),
            );
          } catch (_) {
            myTeam = null;
          }
        }
        final hasMyTeam = myTeam != null;

        final tabs = <Tab>[const Tab(text: 'Overview')];
        if (isStarted) {
          tabs.add(const Tab(text: 'Scores'));
          tabs.add(const Tab(text: 'Brackets'));
        }
        if (hasMyTeam) tabs.add(const Tab(text: 'My Schedule'));

        if (_tabController.length != tabs.length) {
          _tabController.dispose();
          _tabController = TabController(length: tabs.length, vsync: this);
        }

        void refresh() =>
            ref.invalidate(tournamentDetailProvider(widget.tournamentId));

        return Scaffold(
          body: NestedScrollView(
            headerSliverBuilder: (_, __) => [
              SliverAppBar(
                expandedHeight: 120,
                pinned: true,
                title: Text(
                  t.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                flexibleSpace: Container(
                  decoration: BoxDecoration(
                    gradient: AppThemeTokens.heroGrad(context),
                  ),
                ),
                actions: [
                  if (isAdmin)
                    IconButton(
                      icon: const Icon(Icons.edit_outlined),
                      tooltip: 'Edit tournament',
                      onPressed: () =>
                          context.push('/tournaments/${t.id}/edit', extra: t),
                    ),
                  if (isAdmin)
                    IconButton(
                      icon: const Icon(Icons.admin_panel_settings_outlined),
                      tooltip: 'Admin panel',
                      onPressed: () =>
                          context.push('/tournaments/${t.id}/admins'),
                    ),
                ],
                bottom: TabBar(
                  controller: _tabController,
                  isScrollable: true,
                  tabs: tabs,
                ),
              ),
            ],
            body: TabBarView(
              controller: _tabController,
              children: [
                _OverviewTab(
                  tournament: t,
                  currentUserId: currentUserId,
                  isAdmin: isAdmin,
                  myTeam: myTeam,
                  onRefresh: refresh,
                ),
                if (isStarted) _ScoresTab(tournament: t),
                if (isStarted)
                  _BracketsTab(tournament: t, currentUserId: currentUserId),
                if (hasMyTeam)
                  _MyScheduleTab(
                    tournament: t,
                    myTeam: myTeam!,
                    currentUserId: currentUserId ?? '',
                    onRefresh: refresh,
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

class _OverviewTab extends ConsumerStatefulWidget {
  const _OverviewTab({
    required this.tournament,
    required this.currentUserId,
    required this.isAdmin,
    required this.myTeam,
    required this.onRefresh,
  });

  final TournamentModel tournament;
  final String? currentUserId;
  final bool isAdmin;
  final TournamentTeamModel? myTeam;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_OverviewTab> createState() => _OverviewTabState();
}

class _OverviewTabState extends ConsumerState<_OverviewTab> {
  TournamentModel get t => widget.tournament;
  bool get isAdmin => widget.isAdmin;
  TournamentTeamModel? get myTeam => widget.myTeam;
  String? get currentUserId => widget.currentUserId;
  VoidCallback get onRefresh => widget.onRefresh;

  @override
  Widget build(BuildContext context) {
    final canRegister = t.status == 'registration' && myTeam == null;
    final canUnregister = (t.status == 'registration' || t.status == 'draft') &&
        myTeam != null &&
        myTeam!.captainUserId == currentUserId;
    final dateFormat = DateFormat.yMMMd();

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _InfoCard(children: [
            _InfoRow(
                icon: Icons.emoji_events_outlined,
                label: 'Sport',
                value: t.sportType),
            _InfoRow(
                icon: Icons.account_tree_outlined,
                label: 'Format',
                value: _fmtLabel(t.format)),
            _InfoRow(
                icon: Icons.info_outline,
                label: 'Status',
                value: _statusLabel(t.status)),
            if (t.startDate != null)
              _InfoRow(
                  icon: Icons.play_arrow_outlined,
                  label: 'Start',
                  value: dateFormat.format(t.startDate!.toLocal())),
            if (t.endDate != null)
              _InfoRow(
                  icon: Icons.flag_outlined,
                  label: 'End',
                  value: dateFormat.format(t.endDate!.toLocal())),
            if (t.registrationStartDate != null)
              _InfoRow(
                  icon: Icons.app_registration_outlined,
                  label: 'Reg. Opens',
                  value: dateFormat.format(t.registrationStartDate!.toLocal())),
            if (t.registrationDeadline != null)
              _InfoRow(
                  icon: Icons.event_busy_outlined,
                  label: 'Reg. Closes',
                  value: dateFormat.format(t.registrationDeadline!.toLocal())),
            if (t.locationName != null || t.location != null)
              _InfoRow(
                  icon: Icons.location_on_outlined,
                  label: 'Location',
                  value: t.locationName ?? t.location ?? ''),
          ]),
          if (t.description != null) ...[
            const SizedBox(height: 12),
            _SectionCard(
                title: 'About',
                child: Text(t.description!,
                    style: TextStyle(
                        color: AppThemeTokens.textSecondary(context),
                        fontSize: 14))),
          ],
          if (t.rulesDescription != null) ...[
            const SizedBox(height: 12),
            _SectionCard(
                title: 'Rules',
                child: Text(t.rulesDescription!,
                    style: TextStyle(
                        color: AppThemeTokens.textSecondary(context),
                        fontSize: 14))),
          ],
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Admins',
            child: _AdminList(
              organizerName: t.organizerName,
              organizerEmail: t.organizerEmail,
              admins: t.admins,
            ),
          ),
          if (t.prizesDescription != null) ...[
            const SizedBox(height: 12),
            _SectionCard(
                title: 'Prizes',
                child: Text(t.prizesDescription!,
                    style: TextStyle(
                        color: AppThemeTokens.textSecondary(context),
                        fontSize: 14))),
          ],
          if (canRegister) ...[
            const SizedBox(height: 16),
            UiPrimaryButton(
              text: 'Register My Team',
              icon: Icons.add_circle_outline,
              onPressed: () async {
                final ok =
                    await context.push<bool>('/tournaments/${t.id}/register');
                if (ok == true) onRefresh();
              },
            ),
          ],
          if (myTeam != null) ...[
            const SizedBox(height: 16),
            _SectionCard(
              title: 'My Team — ${myTeam!.name}',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                      '${myTeam!.wins}W / ${myTeam!.losses}L — ${myTeam!.points} pts',
                      style: const TextStyle(fontWeight: FontWeight.w500)),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.group_outlined, size: 16),
                    label: const Text('Manage Roster'),
                    onPressed: () => context.push(
                        '/tournaments/${t.id}/teams/${myTeam!.id}/roster'),
                  ),
                  if (canUnregister) ...[
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      icon: const Icon(Icons.remove_circle_outline, size: 16),
                      label: const Text('Unregister Team'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Theme.of(context).colorScheme.error,
                      ),
                      onPressed: () => _confirmUnregister(context),
                    ),
                  ],
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          if (t.categories.isNotEmpty)
            for (final cat in t.categories)
              _CategorySection(category: cat, isAdmin: isAdmin, tournament: t)
          else if (t.pools.isNotEmpty) ...[
            UiSectionTitle('Pools'),
            const SizedBox(height: 8),
            for (final pool in t.pools)
              _PoolCard(pool: pool, isAdmin: isAdmin, tournament: t),
          ] else ...[
            UiSectionTitle('Teams'),
            const SizedBox(height: 8),
            if (t.teams.isEmpty)
              const UiEmptyState(
                  icon: Icons.people_outline,
                  message: 'No teams registered yet.')
            else
              for (final team in t.teams)
                _TeamRow(team: team, tournamentId: t.id),
          ],
          if (isAdmin) ...[
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 8),
            UiSectionTitle('Admin Controls'),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              OutlinedButton.icon(
                icon: const Icon(Icons.layers_outlined, size: 16),
                label: const Text('Manage Pools'),
                onPressed: () => context.push('/tournaments/${t.id}/pools'),
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.category_outlined, size: 16),
                label: const Text('Categories'),
                onPressed: () =>
                    context.push('/tournaments/${t.id}/categories'),
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.supervisor_account_outlined, size: 16),
                label: const Text('Admins'),
                onPressed: () => context.push('/tournaments/${t.id}/admins'),
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.sports_outlined, size: 16),
                label: const Text('Matches'),
                onPressed: () =>
                    context.push('/tournaments/${t.id}/matches', extra: t),
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.pending_actions_outlined, size: 16),
                label: const Text('Update Status'),
                onPressed: () => _showStatusDialog(context, t, onRefresh),
              ),
            ]),
          ],
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  void _showStatusDialog(
      BuildContext context, TournamentModel t, VoidCallback onRefresh) {
    final Map<String, List<String>> transitions = {
      'draft': ['registration', 'cancelled'],
      'registration': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': [],
    };
    final allowed = transitions[t.status] ?? [];
    if (allowed.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(
                'Tournament is ${t.status} — no further transitions available')),
      );
      return;
    }
    showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Update Status'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final s in allowed)
              ListTile(
                title: Text(_statusLabel(s)),
                onTap: () => Navigator.pop(ctx, s),
              ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel'))
        ],
      ),
    ).then((newStatus) async {
      if (newStatus == null) return;
      try {
        await ref
            .read(tournamentRepositoryProvider)
            .updateTournamentStatus(t.id, newStatus);
        onRefresh();
      } on Exception catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(extractErrorMessage(e)),
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
          );
        }
      }
    });
  }

  Future<void> _confirmUnregister(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unregister Team'),
        content: const Text(
          'Do you want to unregister your team from this tournament? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
              foregroundColor: Theme.of(context).colorScheme.onError,
            ),
            child: const Text('Unregister'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(tournamentRepositoryProvider).selfUnregisterTeam(t.id);
      onRefresh();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Team unregistered successfully')),
        );
      }
    } on Exception catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    }
  }

  String _fmtLabel(String f) {
    const m = {
      'single_elimination': 'Single Elimination',
      'double_elimination': 'Double Elimination',
      'round_robin': 'Round Robin',
      'groups_knockout': 'Groups + Knockout',
      'bracket': 'Bracket',
      'pool': 'Pool Round Robin',
    };
    return m[f] ?? f;
  }

  String _statusLabel(String s) {
    const m = {
      'draft': 'Draft',
      'registration': 'Registration Open',
      'in_progress': 'In Progress',
      'active': 'Active',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return m[s] ?? s;
  }
}

class _CategorySection extends StatelessWidget {
  const _CategorySection(
      {required this.category,
      required this.isAdmin,
      required this.tournament});

  final TournamentCategoryModel category;
  final bool isAdmin;
  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        UiSectionTitle(category.name),
        if (category.description != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(category.description!,
                style: TextStyle(
                    color: AppThemeTokens.textSecondary(context),
                    fontSize: 13)),
          ),
        const SizedBox(height: 6),
        if (category.pools.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text('No pools in this category.',
                style: TextStyle(
                    color: AppThemeTokens.textMuted(context), fontSize: 13)),
          )
        else
          for (final pool in category.pools)
            _PoolCard(pool: pool, isAdmin: isAdmin, tournament: tournament),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _PoolCard extends StatelessWidget {
  const _PoolCard(
      {required this.pool, required this.isAdmin, required this.tournament});

  final TournamentPoolModel pool;
  final bool isAdmin;
  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final isFull = pool.isFull;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppThemeTokens.cardElevated(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
            child: Row(
              children: [
                Expanded(
                    child: Text(pool.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 14))),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: isFull
                        ? Colors.red.withValues(alpha: 0.15)
                        : Colors.green.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${pool.teams.length}/${pool.maxTeams}',
                    style: TextStyle(
                        color: isFull ? Colors.red : Colors.green,
                        fontSize: 12,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          for (final team in pool.teams)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
              child: _TeamRow(team: team, tournamentId: tournament.id),
            ),
          if (pool.waitlist.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 2),
              child: Text('Waitlist (${pool.waitlist.length})',
                  style: TextStyle(
                      color: AppThemeTokens.textMuted(context), fontSize: 12)),
            ),
            for (final w in pool.waitlist)
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                child: Text('${w.position + 1}. ${w.teamName}',
                    style: TextStyle(
                        color: AppThemeTokens.textSecondary(context),
                        fontSize: 13)),
              ),
          ],
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _TeamRow extends StatelessWidget {
  const _TeamRow({required this.team, required this.tournamentId});

  final TournamentTeamModel team;
  final String tournamentId;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () =>
          context.push('/tournaments/$tournamentId/teams/${team.id}/roster'),
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Icon(Icons.shield_outlined,
                size: 16, color: AppThemeTokens.textMuted(context)),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                team.name,
                style: const TextStyle(fontSize: 13),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                '${team.wins}W ${team.losses}L',
                style: TextStyle(
                  color: AppThemeTokens.textMuted(context),
                  fontSize: 12,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.right,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Scores Tab
// ---------------------------------------------------------------------------

// Internal view model for a standings row – adapts both standings and team-only data.
class _StandingRow {
  _StandingRow({
    required this.name,
    required this.wins,
    required this.losses,
    required this.draws,
    required this.points,
    this.gf,
    this.ga,
  });

  final String name;
  final int wins;
  final int losses;
  final int draws;
  final int points;
  final int? gf; // goals / points scored
  final int? ga; // goals / points conceded
  int? get gd => gf != null && ga != null ? gf! - ga! : null;
  int get played => wins + losses + draws;

  factory _StandingRow.fromStanding(TournamentStandingModel s) => _StandingRow(
      name: s.teamName,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      points: s.points,
      gf: s.goalsFor,
      ga: s.goalsAgainst);

  factory _StandingRow.fromTeam(TournamentTeamModel t) => _StandingRow(
      name: t.name, wins: t.wins, losses: t.losses, draws: 0, points: t.points);
}

class _ScoresTab extends StatelessWidget {
  const _ScoresTab({required this.tournament});

  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final t = tournament;
    final hasStandings = t.standings.isNotEmpty;

    // Build teamId→poolId lookup
    final teamPoolMap = {for (final tm in t.teams) tm.id: tm.poolId};

    // Helper: get rows for a pool (or all teams if no pool given)
    List<_StandingRow> rowsForPool(String? poolId) {
      if (hasStandings) {
        final filtered = poolId == null
            ? t.standings
            : t.standings
                .where((s) => teamPoolMap[s.teamId] == poolId)
                .toList();
        if (filtered.isEmpty && poolId != null) {
          // Fallback to teams if standings not yet populated for this pool
          final poolTeams = t.teams.where((tm) => tm.poolId == poolId).toList();
          return poolTeams.map(_StandingRow.fromTeam).toList();
        }
        return filtered.map(_StandingRow.fromStanding).toList();
      } else {
        final poolTeams = poolId == null
            ? t.teams
            : t.teams.where((tm) => tm.poolId == poolId).toList();
        return poolTeams.map(_StandingRow.fromTeam).toList();
      }
    }

    if (t.teams.isEmpty && !hasStandings) {
      return const UiEmptyState(
          icon: Icons.leaderboard_outlined, message: 'No scores yet.');
    }

    final showGF = hasStandings &&
        t.standings.any((s) => s.goalsFor > 0 || s.goalsAgainst > 0);

    Widget buildSection(String title, String? poolId) {
      final rows = rowsForPool(poolId);
      if (rows.isEmpty) return const SizedBox.shrink();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UiSectionTitle(title),
          const SizedBox(height: 6),
          _ScoreTable(rows: rows, showGoals: showGF),
          const SizedBox(height: 16),
        ],
      );
    }

    final children = <Widget>[];

    if (t.categories.isNotEmpty) {
      // Group by category → pool hierarchy
      for (final cat in t.categories) {
        if (cat.pools.isEmpty) continue;
        children.add(Padding(
          padding: const EdgeInsets.only(bottom: 2),
          child: Text(cat.name.toUpperCase(),
              style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 11,
                  letterSpacing: 1.2,
                  color: AppThemeTokens.textMuted(context))),
        ));
        for (final pool in cat.pools) {
          children.add(buildSection(pool.name, pool.id));
        }
      }
      // Uncategorised pools
      final catPoolIds =
          t.categories.expand((c) => c.pools.map((p) => p.id)).toSet();
      final uncatPools =
          t.pools.where((p) => !catPoolIds.contains(p.id)).toList();
      for (final pool in uncatPools) {
        children.add(buildSection(pool.name, pool.id));
      }
    } else if (t.pools.isNotEmpty) {
      for (final pool in t.pools) {
        children.add(buildSection(pool.name, pool.id));
      }
      // Teams not in any pool
      final poolTeamIds =
          t.pools.expand((p) => p.teams.map((tm) => tm.id)).toSet();
      final unassigned =
          t.teams.where((tm) => !poolTeamIds.contains(tm.id)).toList();
      if (unassigned.isNotEmpty) {
        final rows = hasStandings
            ? t.standings
                .where((s) => !poolTeamIds.contains(s.teamId))
                .map(_StandingRow.fromStanding)
                .toList()
            : unassigned.map(_StandingRow.fromTeam).toList();
        if (rows.isNotEmpty) {
          children.add(UiSectionTitle('Other'));
          children.add(const SizedBox(height: 6));
          children.add(_ScoreTable(rows: rows, showGoals: showGF));
          children.add(const SizedBox(height: 16));
        }
      }
    } else {
      final rows = rowsForPool(null);
      if (rows.isEmpty)
        return const UiEmptyState(
            icon: Icons.leaderboard_outlined, message: 'No scores yet.');
      children.add(_ScoreTable(rows: rows, showGoals: showGF));
      children.add(const SizedBox(height: 16));
    }

    if (children.isEmpty) {
      return const UiEmptyState(
          icon: Icons.leaderboard_outlined, message: 'No scores yet.');
    }
    return ListView(padding: const EdgeInsets.all(16), children: children);
  }
}

class _ScoreTable extends StatelessWidget {
  const _ScoreTable({required this.rows, this.showGoals = false});

  final List<_StandingRow> rows;
  final bool showGoals;

  @override
  Widget build(BuildContext context) {
    final sorted = [...rows]..sort((a, b) {
        final pd = b.points.compareTo(a.points);
        if (pd != 0) return pd;
        if (showGoals) {
          final gdd = (b.gd ?? 0).compareTo(a.gd ?? 0);
          if (gdd != 0) return gdd;
          return (b.gf ?? 0).compareTo(a.gf ?? 0);
        }
        return b.wins.compareTo(a.wins);
      });

    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.card(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: ConstrainedBox(
          constraints:
              BoxConstraints(minWidth: MediaQuery.of(context).size.width - 32),
          child: Column(
            children: [
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(children: [
                  const SizedBox(width: 24),
                  const SizedBox(
                      width: 160,
                      child: Text('Team',
                          style: TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 12))),
                  const SizedBox(
                      width: 32,
                      child: Text('P',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 12))),
                  const SizedBox(
                      width: 32,
                      child: Text('W',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 12))),
                  if (rows.any((r) => r.draws > 0))
                    const SizedBox(
                        width: 32,
                        child: Text('D',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 12))),
                  const SizedBox(
                      width: 32,
                      child: Text('L',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 12))),
                  if (showGoals) ...[
                    const SizedBox(
                        width: 36,
                        child: Text('GF',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 12))),
                    const SizedBox(
                        width: 36,
                        child: Text('GA',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 12))),
                    const SizedBox(
                        width: 36,
                        child: Text('GD',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 12))),
                  ],
                  const SizedBox(
                      width: 40,
                      child: Text('Pts',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 12))),
                ]),
              ),
              const Divider(height: 1),
              for (int i = 0; i < sorted.length; i++) ...[
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(children: [
                    SizedBox(
                        width: 24,
                        child: Text('${i + 1}',
                            style: TextStyle(
                                color: AppThemeTokens.textMuted(context),
                                fontSize: 13))),
                    SizedBox(
                        width: 160,
                        child: Text(sorted[i].name,
                            style: const TextStyle(fontSize: 13),
                            overflow: TextOverflow.ellipsis)),
                    SizedBox(
                        width: 32,
                        child: Text('${sorted[i].played}',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                color: AppThemeTokens.textSecondary(context),
                                fontSize: 13))),
                    SizedBox(
                        width: 32,
                        child: Text('${sorted[i].wins}',
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 13))),
                    if (rows.any((r) => r.draws > 0))
                      SizedBox(
                          width: 32,
                          child: Text('${sorted[i].draws}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 13))),
                    SizedBox(
                        width: 32,
                        child: Text('${sorted[i].losses}',
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 13))),
                    if (showGoals) ...[
                      SizedBox(
                          width: 36,
                          child: Text('${sorted[i].gf ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 13))),
                      SizedBox(
                          width: 36,
                          child: Text('${sorted[i].ga ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 13))),
                      SizedBox(
                          width: 36,
                          child: Text(
                            '${(sorted[i].gd ?? 0) >= 0 ? '+' : ''}${sorted[i].gd ?? 0}',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontSize: 13,
                                color: (sorted[i].gd ?? 0) >= 0
                                    ? Colors.green
                                    : Colors.red),
                          )),
                    ],
                    SizedBox(
                        width: 40,
                        child: Text('${sorted[i].points}',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: AppThemeTokens.primary500))),
                  ]),
                ),
                if (i < sorted.length - 1) const Divider(height: 1),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// My Schedule Tab
// ---------------------------------------------------------------------------

class _MyScheduleTab extends StatelessWidget {
  const _MyScheduleTab(
      {required this.tournament,
      required this.myTeam,
      required this.currentUserId,
      required this.onRefresh});

  final TournamentModel tournament;
  final TournamentTeamModel myTeam;
  final String currentUserId;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final myMatches = tournament.matches
        .where((m) => m.teamAId == myTeam.id || m.teamBId == myTeam.id)
        .toList();
    if (myMatches.isEmpty) {
      return const UiEmptyState(
          icon: Icons.calendar_today_outlined,
          message: 'No matches scheduled yet.');
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: myMatches.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) => _ScheduleMatchTile(
        match: myMatches[i],
        myTeamId: myTeam.id,
        tournament: tournament,
        currentUserId: currentUserId,
        onScoreSubmitted: onRefresh,
      ),
    );
  }
}

class _ScheduleMatchTile extends ConsumerStatefulWidget {
  const _ScheduleMatchTile(
      {required this.match,
      required this.myTeamId,
      required this.tournament,
      required this.currentUserId,
      required this.onScoreSubmitted});

  final TournamentMatchModel match;
  final String myTeamId;
  final TournamentModel tournament;
  final String currentUserId;
  final VoidCallback onScoreSubmitted;

  @override
  ConsumerState<_ScheduleMatchTile> createState() => _ScheduleMatchTileState();
}

class _ScheduleMatchTileState extends ConsumerState<_ScheduleMatchTile> {
  bool _submitting = false;

  Future<void> _showScoreDialog() async {
    final result = await showDialog<Map<String, int>>(
      context: context,
      builder: (ctx) => ScoreDialog(
        homeTeamName: widget.match.teamAName ?? 'Home',
        awayTeamName: widget.match.teamBName ?? 'Away',
        initialHomeScore: widget.match.scoreA,
        initialAwayScore: widget.match.scoreB,
      ),
    );
    if (result == null || !mounted) return;
    setState(() => _submitting = true);
    try {
      await ref.read(tournamentRepositoryProvider).submitScore(
            widget.tournament.id,
            widget.match.id,
            homeScore: result['home']!,
            awayScore: result['away']!,
          );
      if (mounted) {
        widget.onScoreSubmitted();
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Score submitted!')));
      }
    } on Exception catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.match;
    final hasScore = m.scoreA != null && m.scoreB != null;
    final isMyHome = m.teamAId == widget.myTeamId;
    final opponent = isMyHome ? m.teamBName : m.teamAName;
    final myScore = isMyHome ? m.scoreA : m.scoreB;
    final oppScore = isMyHome ? m.scoreB : m.scoreA;
    final canSubmit = m.status == 'in_progress' ||
        m.status == 'scheduled' ||
        m.status == 'completed';

    return Container(
      decoration: BoxDecoration(
          color: AppThemeTokens.card(context),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.border(context))),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                    child: Text('vs ${opponent ?? "TBD"}',
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 15))),
                _StatusChip(m.status),
              ],
            ),
            if (m.scheduledAt != null) ...[
              const SizedBox(height: 4),
              Text(
                  DateFormat('EEE, MMM d • HH:mm')
                      .format(m.scheduledAt!.toLocal()),
                  style: TextStyle(
                      color: AppThemeTokens.textMuted(context), fontSize: 12)),
            ],
            if (m.location != null)
              Text(m.location!,
                  style: TextStyle(
                      color: AppThemeTokens.textMuted(context), fontSize: 12)),
            if (hasScore)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(
                  children: [
                    Icon(Icons.sports_score_outlined,
                        size: 14, color: AppThemeTokens.textMuted(context)),
                    const SizedBox(width: 4),
                    Text('Score: $myScore – $oppScore',
                        style: const TextStyle(
                            fontWeight: FontWeight.w500, fontSize: 13)),
                  ],
                ),
              ),
            if (canSubmit) ...[
              const SizedBox(height: 8),
              SizedBox(
                height: 32,
                child: OutlinedButton.icon(
                  icon: _submitting
                      ? const SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.edit_outlined, size: 14),
                  label: Text(hasScore ? 'Update Score' : 'Submit Score',
                      style: const TextStyle(fontSize: 12)),
                  onPressed: _submitting ? null : _showScoreDialog,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Brackets Tab
// ---------------------------------------------------------------------------

class _BracketsTab extends StatelessWidget {
  const _BracketsTab({required this.tournament, required this.currentUserId});

  final TournamentModel tournament;
  final String? currentUserId;

  @override
  Widget build(BuildContext context) {
    final matches = tournament.matches;
    if (matches.isEmpty) {
      return const UiEmptyState(
          icon: Icons.account_tree_outlined,
          message: 'Brackets not generated yet.');
    }
    final isPool = tournament.format == 'round_robin' ||
        tournament.format == 'groups_knockout' ||
        tournament.format == 'pool';
    final Map<String, List<TournamentMatchModel>> byRound = {};
    for (final m in matches) {
      byRound.putIfAbsent(m.round, () => []).add(m);
    }

    if (isPool) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final entry in byRound.entries) ...[
            UiSectionTitle(entry.key),
            const SizedBox(height: 6),
            for (final match in entry.value) _MatchTile(match: match),
            const SizedBox(height: 16),
          ],
        ],
      );
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final entry in byRound.entries)
                Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(entry.key,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppThemeTokens.primary400,
                                fontSize: 13)),
                      ),
                      for (final match in entry.value)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: SizedBox(
                              width: 180, child: _MatchTile(match: match)),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MatchTile extends StatelessWidget {
  const _MatchTile({required this.match});

  final TournamentMatchModel match;

  @override
  Widget build(BuildContext context) {
    final m = match;
    final hasScore = m.scoreA != null && m.scoreB != null;
    final aWins = hasScore && m.scoreA! > m.scoreB!;
    final bWins = hasScore && m.scoreB! > m.scoreA!;

    return Container(
      decoration: BoxDecoration(
          color: AppThemeTokens.card(context),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.border(context))),
      child: Column(
        children: [
          _TeamScoreRow(
              name: m.teamAName ?? 'TBD', score: m.scoreA, isWinner: aWins),
          Divider(height: 1, color: AppThemeTokens.border(context)),
          _TeamScoreRow(
              name: m.teamBName ?? 'TBD', score: m.scoreB, isWinner: bWins),
          if (m.scheduledAt != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Text(
                  DateFormat('MMM d, HH:mm').format(m.scheduledAt!.toLocal()),
                  style: TextStyle(
                      color: AppThemeTokens.textMuted(context), fontSize: 10)),
            ),
        ],
      ),
    );
  }
}

class _TeamScoreRow extends StatelessWidget {
  const _TeamScoreRow({required this.name, this.score, required this.isWinner});

  final String name;
  final int? score;
  final bool isWinner;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: Row(
        children: [
          if (isWinner)
            const Icon(Icons.star, size: 12, color: _kAccent)
          else
            const SizedBox(width: 12),
          const SizedBox(width: 4),
          Expanded(
              child: Text(name,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight:
                          isWinner ? FontWeight.bold : FontWeight.normal))),
          if (score != null)
            Text('$score',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isWinner
                        ? AppThemeTokens.primary400
                        : AppThemeTokens.textSecondary(context)))
          else
            Text('–',
                style: TextStyle(
                    color: AppThemeTokens.textMuted(context), fontSize: 13)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Score Dialog
// ---------------------------------------------------------------------------

class ScoreDialog extends StatefulWidget {
  const ScoreDialog(
      {super.key,
      required this.homeTeamName,
      required this.awayTeamName,
      this.initialHomeScore,
      this.initialAwayScore});

  final String homeTeamName;
  final String awayTeamName;
  final int? initialHomeScore;
  final int? initialAwayScore;

  @override
  State<ScoreDialog> createState() => _ScoreDialogState();
}

class _ScoreDialogState extends State<ScoreDialog> {
  late final TextEditingController _homeCtrl;
  late final TextEditingController _awayCtrl;

  @override
  void initState() {
    super.initState();
    _homeCtrl =
        TextEditingController(text: widget.initialHomeScore?.toString() ?? '');
    _awayCtrl =
        TextEditingController(text: widget.initialAwayScore?.toString() ?? '');
  }

  @override
  void dispose() {
    _homeCtrl.dispose();
    _awayCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final home = int.tryParse(_homeCtrl.text.trim());
    final away = int.tryParse(_awayCtrl.text.trim());
    if (home == null || away == null) return;
    Navigator.of(context).pop({'home': home, 'away': away});
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Submit Score'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(children: [
            Expanded(
                child: Text(widget.homeTeamName,
                    style: const TextStyle(fontWeight: FontWeight.w500))),
            SizedBox(
                width: 70,
                child: TextField(
                    controller: _homeCtrl,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    decoration: const InputDecoration(isDense: true)))
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
                child: Text(widget.awayTeamName,
                    style: const TextStyle(fontWeight: FontWeight.w500))),
            SizedBox(
                width: 70,
                child: TextField(
                    controller: _awayCtrl,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    decoration: const InputDecoration(isDense: true)))
          ]),
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel')),
        FilledButton(onPressed: _submit, child: const Text('Submit')),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.status);

  final String status;

  Color _color() {
    switch (status) {
      case 'completed':
        return Colors.grey;
      case 'in_progress':
        return Colors.blue;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
          color: _color().withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12)),
      child: Text(status.replaceAll('_', ' '),
          style: TextStyle(
              color: _color(), fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared helper widgets
// ---------------------------------------------------------------------------

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
          color: AppThemeTokens.card(context),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.border(context))),
      child: Padding(
          padding: const EdgeInsets.all(12), child: Column(children: children)),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(
      {required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(icon, size: 15, color: AppThemeTokens.textMuted(context)),
          const SizedBox(width: 8),
          Text('$label: ',
              style: TextStyle(
                  color: AppThemeTokens.textSecondary(context), fontSize: 13)),
          Expanded(
              child: Text(value,
                  style: const TextStyle(fontSize: 13),
                  overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
          color: AppThemeTokens.card(context),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.border(context))),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style:
                  const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 6),
          child,
        ]),
      ),
    );
  }
}

class _AdminList extends StatelessWidget {
  const _AdminList({
    required this.organizerName,
    required this.organizerEmail,
    required this.admins,
  });

  final String? organizerName;
  final String? organizerEmail;
  final List<TournamentAdminModel> admins;

  @override
  Widget build(BuildContext context) {
    final entries = <String>[
      if ((organizerName ?? '').trim().isNotEmpty)
        '${organizerName!.trim()} (Organizer)'
      else if ((organizerEmail ?? '').trim().isNotEmpty)
        '${organizerEmail!.trim()} (Organizer)',
      ...admins.map((a) {
        final name = a.userName.trim();
        if (name.isNotEmpty) return name;
        final email = a.userEmail.trim();
        if (email.isNotEmpty) return email;
        return 'Admin';
      }),
    ];

    if (entries.isEmpty) {
      return Text(
        'No admins listed.',
        style: TextStyle(
          color: AppThemeTokens.textSecondary(context),
          fontSize: 14,
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < entries.length; i++) ...[
          Text(
            entries[i],
            style: TextStyle(
              color: AppThemeTokens.textSecondary(context),
              fontSize: 14,
            ),
          ),
          if (i != entries.length - 1) const SizedBox(height: 4),
        ]
      ],
    );
  }
}

// ===========================================================================
// Register Team Page
// ===========================================================================

class RegisterTeamPage extends ConsumerStatefulWidget {
  const RegisterTeamPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  ConsumerState<RegisterTeamPage> createState() => _RegisterTeamPageState();
}

class _RegisterTeamPageState extends ConsumerState<RegisterTeamPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  String? _selectedPoolId;
  bool _loading = false;
  bool _poolsLoading = true;
  List<TournamentPoolModel> _pools = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPools();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPools() async {
    try {
      final pools = await ref
          .read(tournamentRepositoryProvider)
          .getPools(widget.tournamentId);
      if (mounted)
        setState(() {
          _pools = pools;
          _poolsLoading = false;
        });
    } on Exception catch (e) {
      if (mounted)
        setState(() {
          _error = extractErrorMessage(e);
          _poolsLoading = false;
        });
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _loading = true);
    try {
      final result = await ref
          .read(tournamentRepositoryProvider)
          .selfRegisterTeam(widget.tournamentId, _nameCtrl.text.trim(),
              poolId: _selectedPoolId);
      if (!mounted) return;
      final onWaitlist = result['onWaitlist'] == true;
      if (onWaitlist) {
        final pool = result['pool'] as Map<String, dynamic>?;
        final poolName = pool?['name'] as String? ?? 'the pool';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content:
              Text('Pool "$poolName" is full — your team is on the waitlist!'),
          backgroundColor: Colors.orange,
        ));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Team registered successfully!')));
      }
      context.pop(true);
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Register Team')),
      body: _poolsLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _loadPools)
              : Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      TextFormField(
                        controller: _nameCtrl,
                        decoration: const InputDecoration(
                            labelText: 'Team name *',
                            prefixIcon: Icon(Icons.shield_outlined)),
                        textCapitalization: TextCapitalization.words,
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                      if (_pools.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        DropdownButtonFormField<String?>(
                          value: _selectedPoolId,
                          decoration: const InputDecoration(
                              labelText: 'Pool (optional)',
                              prefixIcon: Icon(Icons.layers_outlined)),
                          dropdownColor: AppThemeTokens.cardElevated(context),
                          items: [
                            const DropdownMenuItem(
                                value: null, child: Text('No pool')),
                            for (final pool in _pools)
                              DropdownMenuItem(
                                  value: pool.id,
                                  child: Text(
                                      '${pool.name} (${pool.teams.length}/${pool.maxTeams}${pool.isFull ? " – FULL" : ""})'))
                          ],
                          onChanged: (v) => setState(() => _selectedPoolId = v),
                        ),
                      ],
                      const SizedBox(height: 24),
                      UiPrimaryButton(
                          text: 'Register Team',
                          icon: Icons.check_circle_outline,
                          onPressed: _loading ? null : _submit,
                          loading: _loading),
                    ],
                  ),
                ),
    );
  }
}

// ===========================================================================
// Team Roster Page
// ===========================================================================

class TeamRosterPage extends ConsumerStatefulWidget {
  const TeamRosterPage(
      {super.key, required this.tournamentId, required this.teamId});

  final String tournamentId;
  final String teamId;

  @override
  ConsumerState<TeamRosterPage> createState() => _TeamRosterPageState();
}

class _TeamRosterPageState extends ConsumerState<TeamRosterPage> {
  List<Map<String, dynamic>> _players = [];
  List<Map<String, dynamic>> _invitations = [];
  bool _loading = true;
  String? _error;
  String? _captainUserId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(tournamentRepositoryProvider);
      final results = await Future.wait([
        repo.getPlayers(widget.tournamentId, widget.teamId),
        repo.getTeamInvitations(widget.tournamentId, widget.teamId),
        repo.getTournament(widget.tournamentId),
      ]);
      final players = results[0] as List<Map<String, dynamic>>;
      final invitations = results[1] as List<Map<String, dynamic>>;
      final tournament = results[2] as TournamentModel;
      final team =
          tournament.teams.where((t) => t.id == widget.teamId).firstOrNull;
      if (mounted)
        setState(() {
          _players = players;
          _invitations = invitations;
          _captainUserId = team?.captainUserId;
          _loading = false;
        });
    } on Exception catch (e) {
      if (mounted)
        setState(() {
          _error = extractErrorMessage(e);
          _loading = false;
        });
    }
  }

  Future<void> _removePlayer(String playerId) async {
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .removePlayer(widget.tournamentId, widget.teamId, playerId);
      _load();
    } on Exception catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
    }
  }

  Future<void> _showInviteDialog() async {
    final emailCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Invite Player'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
              controller: emailCtrl,
              decoration: const InputDecoration(
                  labelText: 'Email *', prefixIcon: Icon(Icons.email_outlined)),
              keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                  labelText: 'Name (optional)',
                  prefixIcon: Icon(Icons.person_outline))),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              final email = emailCtrl.text.trim();
              if (email.isEmpty) return;
              try {
                await ref
                    .read(tournamentRepositoryProvider)
                    .sendInvitation(widget.tournamentId, widget.teamId, {
                  'inviteeEmail': email,
                  if (nameCtrl.text.trim().isNotEmpty)
                    'inviteeName': nameCtrl.text.trim()
                });
                if (ctx.mounted) Navigator.pop(ctx, true);
              } on Exception catch (e) {
                if (ctx.mounted)
                  ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(content: Text(extractErrorMessage(e))));
              }
            },
            child: const Text('Send Invite'),
          ),
        ],
      ),
    );
    if (result == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = ref.watch(authNotifierProvider).user?.id;
    final isCaptain = _captainUserId == currentUserId;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Team Roster'),
        actions: [
          if (isCaptain)
            IconButton(
                icon: const Icon(Icons.person_add_outlined),
                tooltip: 'Invite player',
                onPressed: _showInviteDialog),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      UiSectionTitle('Players (${_players.length})'),
                      const SizedBox(height: 8),
                      if (_players.isEmpty)
                        const UiEmptyState(
                            icon: Icons.people_outline,
                            message: 'No players yet.')
                      else
                        for (final p in _players)
                          ListTile(
                            leading: const CircleAvatar(
                                child: Icon(Icons.person_outline)),
                            title: Text(
                                (p['user'] as Map?)?['name'] as String? ??
                                    p['playerName'] as String? ??
                                    'Unknown'),
                            subtitle: Text(
                                (p['user'] as Map?)?['email'] as String? ?? ''),
                            trailing: isCaptain
                                ? IconButton(
                                    icon: const Icon(
                                        Icons.remove_circle_outline,
                                        color: Colors.red),
                                    onPressed: () =>
                                        _removePlayer(p['id'] as String))
                                : null,
                          ),
                      if (_invitations.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        UiSectionTitle('Pending Invitations'),
                        const SizedBox(height: 8),
                        for (final inv in _invitations)
                          ListTile(
                            leading: const CircleAvatar(
                                child: Icon(Icons.mail_outline)),
                            title: Text(inv['inviteeName'] as String? ??
                                inv['inviteeEmail'] as String? ??
                                ''),
                            subtitle:
                                Text(inv['inviteeEmail'] as String? ?? ''),
                            trailing: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                  color: Colors.orange.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(12)),
                              child: const Text('pending',
                                  style: TextStyle(
                                      color: Colors.orange,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600)),
                            ),
                          ),
                      ],
                    ],
                  ),
                ),
    );
  }
}

// ===========================================================================
// Admin Management Page
// ===========================================================================

class AdminManagementPage extends ConsumerStatefulWidget {
  const AdminManagementPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  ConsumerState<AdminManagementPage> createState() =>
      _AdminManagementPageState();
}

class _AdminManagementPageState extends ConsumerState<AdminManagementPage> {
  List<TournamentAdminModel> _admins = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final admins = await ref
          .read(tournamentRepositoryProvider)
          .getAdmins(widget.tournamentId);
      if (mounted)
        setState(() {
          _admins = admins;
          _loading = false;
        });
    } on Exception catch (e) {
      if (mounted)
        setState(() {
          _error = extractErrorMessage(e);
          _loading = false;
        });
    }
  }

  Future<void> _addAdmin() async {
    final emailCtrl = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Co-organizer'),
        content: TextField(
            controller: emailCtrl,
            decoration: const InputDecoration(
                labelText: 'User email',
                prefixIcon: Icon(Icons.email_outlined)),
            keyboardType: TextInputType.emailAddress),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              final email = emailCtrl.text.trim();
              if (email.isEmpty) return;
              try {
                await ref
                    .read(tournamentRepositoryProvider)
                    .addAdmin(widget.tournamentId, {'email': email});
                if (ctx.mounted) Navigator.pop(ctx, true);
              } on Exception catch (e) {
                if (ctx.mounted)
                  ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(content: Text(extractErrorMessage(e))));
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
    if (result == true) _load();
  }

  Future<void> _removeAdmin(TournamentAdminModel admin) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Co-organizer'),
        content: Text('Remove ${admin.userName} as co-organizer?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton.tonal(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Remove')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .removeAdmin(widget.tournamentId, admin.userId);
      _load();
    } on Exception catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Management'),
        actions: [
          IconButton(
              icon: const Icon(Icons.person_add_outlined),
              tooltip: 'Add co-organizer',
              onPressed: _addAdmin),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _admins.isEmpty
                      ? const UiEmptyState(
                          icon: Icons.supervisor_account_outlined,
                          message:
                              'No co-organizers yet. Add one to delegate admin rights.')
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _admins.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final admin = _admins[i];
                            return ListTile(
                              tileColor: AppThemeTokens.card(context),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                      AppThemeTokens.radiusMd),
                                  side: BorderSide(
                                      color: AppThemeTokens.border(context))),
                              leading: const CircleAvatar(
                                  child: Icon(Icons.manage_accounts_outlined)),
                              title: Text(admin.userName),
                              subtitle: Text(admin.userEmail),
                              trailing: IconButton(
                                  icon: const Icon(Icons.remove_circle_outline,
                                      color: Colors.red),
                                  onPressed: () => _removeAdmin(admin)),
                            );
                          },
                        ),
                ),
    );
  }
}

// ===========================================================================
// Tournament Invite Page
// ===========================================================================

class TournamentInvitePage extends ConsumerStatefulWidget {
  const TournamentInvitePage({super.key, required this.inviteToken});

  final String inviteToken;

  @override
  ConsumerState<TournamentInvitePage> createState() =>
      _TournamentInvitePageState();
}

class _TournamentInvitePageState extends ConsumerState<TournamentInvitePage> {
  bool _acceptLoading = false;
  bool _declineLoading = false;
  String? _result;
  String? _error;

  Future<void> _accept() async {
    setState(() => _acceptLoading = true);
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .acceptInvitation(widget.inviteToken);
      if (mounted) setState(() => _result = 'accepted');
    } on Exception catch (e) {
      if (mounted) setState(() => _error = extractErrorMessage(e));
    } finally {
      if (mounted) setState(() => _acceptLoading = false);
    }
  }

  Future<void> _decline() async {
    setState(() => _declineLoading = true);
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .declineInvitation(widget.inviteToken);
      if (mounted) setState(() => _result = 'declined');
    } on Exception catch (e) {
      if (mounted) setState(() => _error = extractErrorMessage(e));
    } finally {
      if (mounted) setState(() => _declineLoading = false);
    }
  }

  bool get _anyLoading => _acceptLoading || _declineLoading;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Team Invitation')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: _result != null
              ? Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(
                      _result == 'accepted'
                          ? Icons.check_circle_outline
                          : Icons.cancel_outlined,
                      size: 64,
                      color: _result == 'accepted' ? Colors.green : Colors.red),
                  const SizedBox(height: 16),
                  Text(
                      _result == 'accepted'
                          ? 'You have joined the team!'
                          : 'Invitation declined.',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center),
                  const SizedBox(height: 24),
                  OutlinedButton(
                      onPressed: () => context.go('/tournaments'),
                      child: const Text('View Tournaments')),
                ])
              : Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.mail_outline, size: 64),
                  const SizedBox(height: 16),
                  const Text('You\'ve been invited to join a tournament team!',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                      textAlign: TextAlign.center),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!,
                        style: const TextStyle(color: Colors.red),
                        textAlign: TextAlign.center),
                  ],
                  const SizedBox(height: 32),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    OutlinedButton.icon(
                      icon: _declineLoading
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.close),
                      label: const Text('Decline'),
                      onPressed: _anyLoading ? null : _decline,
                    ),
                    const SizedBox(width: 16),
                    FilledButton.icon(
                      icon: _acceptLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2))
                          : const Icon(Icons.check),
                      label: const Text('Accept'),
                      onPressed: _anyLoading ? null : _accept,
                    ),
                  ]),
                ]),
        ),
      ),
    );
  }
}

// ===========================================================================
// My Invitations Page
// ===========================================================================

class MyInvitationsPage extends ConsumerStatefulWidget {
  const MyInvitationsPage({super.key});

  @override
  ConsumerState<MyInvitationsPage> createState() => _MyInvitationsPageState();
}

class _MyInvitationsPageState extends ConsumerState<MyInvitationsPage> {
  List<Map<String, dynamic>> _invitations = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final invitations =
          await ref.read(tournamentRepositoryProvider).getMyInvitations();
      if (mounted)
        setState(() {
          _invitations = invitations
              .where((i) => (i['status'] as String?) == 'pending')
              .toList();
          _loading = false;
        });
    } on Exception catch (e) {
      if (mounted)
        setState(() {
          _error = extractErrorMessage(e);
          _loading = false;
        });
    }
  }

  Future<void> _respond(String token, bool accept) async {
    try {
      final repo = ref.read(tournamentRepositoryProvider);
      if (accept)
        await repo.acceptInvitation(token);
      else
        await repo.declineInvitation(token);
      _load();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content:
                Text(accept ? 'Joined the team!' : 'Invitation declined.')));
    } on Exception catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Invitations')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _invitations.isEmpty
                      ? const UiEmptyState(
                          icon: Icons.mail_outline,
                          message: 'No pending invitations.')
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _invitations.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final inv = _invitations[i];
                            final token = inv['inviteToken'] as String? ?? '';
                            final team = inv['team'] as Map<String, dynamic>?;
                            final teamName =
                                team?['name'] as String? ?? 'Unknown Team';
                            return Container(
                              decoration: BoxDecoration(
                                  color: AppThemeTokens.card(context),
                                  borderRadius: BorderRadius.circular(
                                      AppThemeTokens.radiusMd),
                                  border: Border.all(
                                      color: AppThemeTokens.border(context))),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text('Invited to join: $teamName',
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w600)),
                                      const SizedBox(height: 8),
                                      Row(children: [
                                        OutlinedButton(
                                            onPressed: () =>
                                                _respond(token, false),
                                            child: const Text('Decline')),
                                        const SizedBox(width: 8),
                                        FilledButton(
                                            onPressed: () =>
                                                _respond(token, true),
                                            child: const Text('Accept')),
                                      ]),
                                    ]),
                              ),
                            );
                          },
                        ),
                ),
    );
  }
}

// ===========================================================================
// Create Tournament Page
// ===========================================================================

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
  final _locationCtrl = TextEditingController();
  final _rulesCtrl = TextEditingController();
  final _prizesCtrl = TextEditingController();

  String _sportType = '';
  String _format = 'single_elimination';
  DateTime? _startDate;
  DateTime? _endDate;
  DateTime? _registrationStartDate;
  DateTime? _registrationDeadline;
  bool _useManualBrackets = false;
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _maxTeamsCtrl.dispose();
    _locationCtrl.dispose();
    _rulesCtrl.dispose();
    _prizesCtrl.dispose();
    super.dispose();
  }

  Future<DateTime?> _pickDate(DateTime? initial, {DateTime? firstDate}) async {
    return showDatePicker(
      context: context,
      initialDate:
          initial ?? (firstDate ?? DateTime.now()).add(const Duration(days: 7)),
      firstDate: firstDate ?? DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    if (_startDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a tournament start date')),
      );
      setState(() => _saving = false);
      return;
    }
    // Validate date ordering
    if (_endDate != null && !_endDate!.isAfter(_startDate!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Tournament end date must be after the start date')),
      );
      setState(() => _saving = false);
      return;
    }
    if (_registrationDeadline != null &&
        !_startDate!.isAfter(_registrationDeadline!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text(
                'Registration deadline must be before the tournament start date')),
      );
      setState(() => _saving = false);
      return;
    }
    if (_registrationStartDate != null &&
        _registrationDeadline != null &&
        !_registrationDeadline!.isAfter(_registrationStartDate!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text(
                'Registration deadline must be after the registration open date')),
      );
      setState(() => _saving = false);
      return;
    }
    try {
      final tournament =
          await ref.read(tournamentRepositoryProvider).createTournament({
        'name': _nameCtrl.text.trim(),
        if (_sportType.isNotEmpty) 'sportType': _sportType,
        'format': _format,
        if (_descCtrl.text.trim().isNotEmpty)
          'description': _descCtrl.text.trim(),
        if (_maxTeamsCtrl.text.trim().isNotEmpty)
          'maxTeams': int.tryParse(_maxTeamsCtrl.text.trim()),
        if (_startDate != null) 'startDate': _startDate!.toIso8601String(),
        if (_endDate != null) 'endDate': _endDate!.toIso8601String(),
        if (_registrationStartDate != null)
          'registrationStartDate': _registrationStartDate!.toIso8601String(),
        if (_registrationDeadline != null)
          'registrationDeadline': _registrationDeadline!.toIso8601String(),
        if (_locationCtrl.text.trim().isNotEmpty)
          'location': _locationCtrl.text.trim(),
        if (_rulesCtrl.text.trim().isNotEmpty)
          'rulesDescription': _rulesCtrl.text.trim(),
        if (_prizesCtrl.text.trim().isNotEmpty)
          'prizesDescription': _prizesCtrl.text.trim(),
        'useManualBrackets': _useManualBrackets,
      });
      ref.read(tournamentsNotifierProvider.notifier).reload();
      if (!mounted) return;

      // Prompt to set up pools/categories immediately after creation
      final setup = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Tournament Created! 🎉'),
          content: const Text(
              'Would you like to set up pools or categories now to organise your teams?'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, 'skip'),
                child: const Text('Skip')),
            OutlinedButton(
                onPressed: () => Navigator.pop(ctx, 'categories'),
                child: const Text('Categories')),
            FilledButton(
                onPressed: () => Navigator.pop(ctx, 'pools'),
                child: const Text('Pools')),
          ],
        ),
      );
      if (!mounted) return;
      if (setup == 'pools') {
        context.go('/tournaments/${tournament.id}/pools');
      } else if (setup == 'categories') {
        context.go('/tournaments/${tournament.id}/categories');
      } else {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Tournament created!')));
        context.go('/tournaments/${tournament.id}');
      }
    } on Exception catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(error)),
          backgroundColor: Theme.of(context).colorScheme.error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _dateTile(
      {required String label,
      required DateTime? value,
      required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InputDecorator(
        decoration: InputDecoration(
            labelText: label,
            prefixIcon: const Icon(Icons.calendar_today_outlined)),
        child: Text(
          value != null ? DateFormat.yMMMd().format(value) : 'Tap to select',
          style: TextStyle(
              color: value == null
                  ? AppThemeTokens.textSecondary(context)
                  : AppThemeTokens.text(context),
              fontSize: 14),
        ),
      ),
    );
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
            UiSectionTitle('Basic Info'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                  labelText: 'Tournament name *',
                  prefixIcon: Icon(Icons.emoji_events_outlined)),
              textCapitalization: TextCapitalization.words,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _sportType.isNotEmpty ? _sportType : null,
              decoration: const InputDecoration(
                  labelText: 'Sport type *',
                  prefixIcon: Icon(Icons.sports_outlined)),
              dropdownColor: AppThemeTokens.cardElevated(context),
              items: kSportTypes
                  .where((s) => s['value']!.isNotEmpty)
                  .map((s) => DropdownMenuItem(
                      value: s['value'], child: Text(s['label']!)))
                  .toList(),
              validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              onChanged: (v) => setState(() => _sportType = v ?? ''),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _format,
              decoration: const InputDecoration(
                  labelText: 'Format *',
                  prefixIcon: Icon(Icons.account_tree_outlined)),
              dropdownColor: AppThemeTokens.cardElevated(context),
              items: const [
                DropdownMenuItem(
                    value: 'single_elimination',
                    child: Text('Single Elimination')),
                DropdownMenuItem(
                    value: 'double_elimination',
                    child: Text('Double Elimination')),
                DropdownMenuItem(
                    value: 'round_robin', child: Text('Round Robin')),
                DropdownMenuItem(
                    value: 'groups_knockout', child: Text('Groups + Knockout')),
              ],
              onChanged: (v) =>
                  setState(() => _format = v ?? 'single_elimination'),
            ),
            const SizedBox(height: 16),
            TextFormField(
                controller: _descCtrl,
                decoration: const InputDecoration(
                    labelText: 'Description',
                    prefixIcon: Icon(Icons.notes_outlined),
                    alignLabelWithHint: true),
                maxLines: 3),
            const SizedBox(height: 16),
            TextFormField(
                controller: _maxTeamsCtrl,
                decoration: const InputDecoration(
                    labelText: 'Max teams',
                    prefixIcon: Icon(Icons.group_outlined)),
                keyboardType: TextInputType.number,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return null;
                  final n = int.tryParse(v.trim());
                  if (n == null) return 'Must be a number';
                  if (n < 2) return 'At least 2 teams required';
                  if (n > 1000) return 'Max 1,000 teams';
                  return null;
                }),
            const SizedBox(height: 24),
            UiSectionTitle('Dates'),
            const SizedBox(height: 8),
            _dateTile(
                label: 'Registration opens',
                value: _registrationStartDate,
                onTap: () async {
                  final d = await _pickDate(_registrationStartDate);
                  if (d != null) setState(() => _registrationStartDate = d);
                }),
            const SizedBox(height: 12),
            _dateTile(
                label: 'Registration deadline',
                value: _registrationDeadline,
                onTap: () async {
                  final d = await _pickDate(_registrationDeadline);
                  if (d != null) setState(() => _registrationDeadline = d);
                }),
            const SizedBox(height: 12),
            _dateTile(
                label: 'Tournament start *',
                value: _startDate,
                onTap: () async {
                  final d = await _pickDate(_startDate);
                  if (d != null) setState(() => _startDate = d);
                }),
            if (_startDate == null && _saving)
              Padding(
                padding: const EdgeInsets.only(top: 4, left: 12),
                child: Text('Please select a start date',
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                        fontSize: 12)),
              ),
            const SizedBox(height: 12),
            _dateTile(
                label: 'Tournament end',
                value: _endDate,
                onTap: () async {
                  final d = await _pickDate(_endDate, firstDate: _startDate);
                  if (d != null) setState(() => _endDate = d);
                }),
            const SizedBox(height: 24),
            UiSectionTitle('Location'),
            const SizedBox(height: 8),
            TextFormField(
                controller: _locationCtrl,
                decoration: const InputDecoration(
                    labelText: 'Location / Venue',
                    prefixIcon: Icon(Icons.location_on_outlined))),
            const SizedBox(height: 24),
            UiSectionTitle('Additional Info'),
            const SizedBox(height: 8),
            TextFormField(
                controller: _rulesCtrl,
                decoration: const InputDecoration(
                    labelText: 'Rules',
                    prefixIcon: Icon(Icons.rule_outlined),
                    alignLabelWithHint: true),
                maxLines: 4),
            const SizedBox(height: 16),
            TextFormField(
                controller: _prizesCtrl,
                decoration: const InputDecoration(
                    labelText: 'Prizes',
                    prefixIcon: Icon(Icons.card_giftcard_outlined),
                    alignLabelWithHint: true),
                maxLines: 3),
            const SizedBox(height: 24),
            UiSectionTitle('Settings'),
            SwitchListTile(
              title: const Text('Manual pool/bracket management'),
              subtitle: const Text(
                  'Manually create pools and assign teams instead of auto-generating'),
              value: _useManualBrackets,
              onChanged: (v) => setState(() => _useManualBrackets = v),
            ),
            const SizedBox(height: 28),
            UiPrimaryButton(
                text: 'Create Tournament',
                icon: Icons.add_circle_outline,
                onPressed: _saving ? null : _submit,
                loading: _saving),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ===========================================================================
// Pools Management Page
// ===========================================================================

class PoolsManagementPage extends ConsumerStatefulWidget {
  const PoolsManagementPage({super.key, required this.tournamentId});
  final String tournamentId;

  @override
  ConsumerState<PoolsManagementPage> createState() =>
      _PoolsManagementPageState();
}

class _PoolsManagementPageState extends ConsumerState<PoolsManagementPage> {
  List<TournamentPoolModel> _pools = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final pools = await ref
          .read(tournamentRepositoryProvider)
          .getPools(widget.tournamentId);
      if (mounted)
        setState(() {
          _pools = pools;
          _loading = false;
        });
    } on Exception catch (e) {
      if (mounted)
        setState(() {
          _error = extractErrorMessage(e);
          _loading = false;
        });
    }
  }

  Future<void> _createPool() async {
    final nameCtrl = TextEditingController();
    final maxCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Create Pool'),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Pool name *'),
                textCapitalization: TextCapitalization.words),
            const SizedBox(height: 12),
            TextField(
                controller: maxCtrl,
                decoration: const InputDecoration(labelText: 'Max teams *'),
                keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            TextField(
                controller: descCtrl,
                decoration:
                    const InputDecoration(labelText: 'Description (optional)')),
          ]),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Create')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final name = nameCtrl.text.trim();
    final maxTeams = int.tryParse(maxCtrl.text.trim());
    if (name.isEmpty || maxTeams == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Pool name and max teams are required')));
      return;
    }
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .createPool(widget.tournamentId, {
        'name': name,
        'maxTeams': maxTeams,
        if (descCtrl.text.trim().isNotEmpty)
          'description': descCtrl.text.trim(),
      });
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _editPool(TournamentPoolModel pool) async {
    final nameCtrl = TextEditingController(text: pool.name);
    final maxCtrl = TextEditingController(text: '${pool.maxTeams}');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit Pool'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Pool name *'),
              textCapitalization: TextCapitalization.words),
          const SizedBox(height: 12),
          TextField(
              controller: maxCtrl,
              decoration: const InputDecoration(labelText: 'Max teams *'),
              keyboardType: TextInputType.number),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Save')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final name = nameCtrl.text.trim();
    final maxTeams = int.tryParse(maxCtrl.text.trim());
    if (name.isEmpty || maxTeams == null) return;
    try {
      await ref.read(tournamentRepositoryProvider).updatePool(
          widget.tournamentId, pool.id, {'name': name, 'maxTeams': maxTeams});
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _deletePool(TournamentPoolModel pool) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Pool'),
        content: Text(
            'Delete "${pool.name}"? This cannot be undone. All teams must be removed first.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(ctx).colorScheme.error),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .deletePool(widget.tournamentId, pool.id);
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _removeTeam(String poolId, TournamentTeamModel team) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Team'),
        content: Text('Remove "${team.name}" from this pool?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(ctx).colorScheme.error),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Remove')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .removeTeamFromPool(widget.tournamentId, poolId, team.id);
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Pools')),
      floatingActionButton: FloatingActionButton(
        onPressed: _createPool,
        tooltip: 'Create pool',
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _pools.isEmpty
                      ? const UiEmptyState(
                          icon: Icons.layers_outlined,
                          message: 'No pools yet. Tap + to create one.')
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _pools.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (context, i) {
                            final pool = _pools[i];
                            return Container(
                              decoration: BoxDecoration(
                                color: AppThemeTokens.card(context),
                                borderRadius: BorderRadius.circular(
                                    AppThemeTokens.radiusMd),
                                border: Border.all(
                                    color: AppThemeTokens.border(context)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ListTile(
                                    leading: const Icon(Icons.layers_outlined),
                                    title: Text(pool.name,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w600)),
                                    subtitle: Text(
                                        '${pool.teams.length}/${pool.maxTeams} teams${pool.waitlist.isNotEmpty ? ' · ${pool.waitlist.length} waiting' : ''}'),
                                    trailing: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          IconButton(
                                              icon: const Icon(
                                                  Icons.edit_outlined,
                                                  size: 18),
                                              tooltip: 'Edit',
                                              onPressed: () => _editPool(pool)),
                                          IconButton(
                                              icon: const Icon(
                                                  Icons.delete_outline,
                                                  size: 18),
                                              tooltip: 'Delete',
                                              onPressed: () =>
                                                  _deletePool(pool)),
                                        ]),
                                  ),
                                  if (pool.teams.isNotEmpty) ...[
                                    const Divider(height: 1),
                                    for (final team in pool.teams)
                                      ListTile(
                                        dense: true,
                                        leading: const Icon(
                                            Icons.shield_outlined,
                                            size: 16),
                                        title: Text(team.name,
                                            style:
                                                const TextStyle(fontSize: 13)),
                                        trailing: IconButton(
                                          icon: const Icon(
                                              Icons.person_remove_outlined,
                                              size: 16),
                                          tooltip: 'Remove from pool',
                                          onPressed: () =>
                                              _removeTeam(pool.id, team),
                                        ),
                                      ),
                                  ],
                                  if (pool.waitlist.isNotEmpty) ...[
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(
                                          16, 4, 16, 2),
                                      child: Text('Waitlist',
                                          style: TextStyle(
                                              color: AppThemeTokens.textMuted(
                                                  context),
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600)),
                                    ),
                                    for (final w in pool.waitlist)
                                      ListTile(
                                        dense: true,
                                        leading: Text('${w.position + 1}.',
                                            style: TextStyle(
                                                color: AppThemeTokens.textMuted(
                                                    context))),
                                        title: Text(w.teamName,
                                            style: TextStyle(
                                                color: AppThemeTokens
                                                    .textSecondary(context),
                                                fontSize: 13)),
                                      ),
                                  ],
                                  const SizedBox(height: 4),
                                ],
                              ),
                            );
                          },
                        ),
                ),
    );
  }
}

// ===========================================================================
// Categories Management Page
// ===========================================================================

class CategoriesManagementPage extends ConsumerStatefulWidget {
  const CategoriesManagementPage({super.key, required this.tournamentId});
  final String tournamentId;

  @override
  ConsumerState<CategoriesManagementPage> createState() =>
      _CategoriesManagementPageState();
}

class _CategoriesManagementPageState
    extends ConsumerState<CategoriesManagementPage> {
  List<TournamentCategoryModel> _categories = [];
  List<TournamentPoolModel> _pools = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        ref
            .read(tournamentRepositoryProvider)
            .getCategories(widget.tournamentId),
        ref.read(tournamentRepositoryProvider).getPools(widget.tournamentId),
      ]);
      if (mounted) {
        setState(() {
          _categories = results[0] as List<TournamentCategoryModel>;
          _pools = results[1] as List<TournamentPoolModel>;
          _loading = false;
        });
      }
    } on Exception catch (e) {
      if (mounted)
        setState(() {
          _error = extractErrorMessage(e);
          _loading = false;
        });
    }
  }

  Future<void> _createCategory() async {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Create Category'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Category name *'),
              textCapitalization: TextCapitalization.words),
          const SizedBox(height: 12),
          TextField(
              controller: descCtrl,
              decoration:
                  const InputDecoration(labelText: 'Description (optional)')),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Create')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final name = nameCtrl.text.trim();
    if (name.isEmpty) return;
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .createCategory(widget.tournamentId, {
        'name': name,
        if (descCtrl.text.trim().isNotEmpty)
          'description': descCtrl.text.trim(),
      });
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _editCategory(TournamentCategoryModel cat) async {
    final nameCtrl = TextEditingController(text: cat.name);
    final descCtrl = TextEditingController(text: cat.description ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit Category'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Category name *'),
              textCapitalization: TextCapitalization.words),
          const SizedBox(height: 12),
          TextField(
              controller: descCtrl,
              decoration:
                  const InputDecoration(labelText: 'Description (optional)')),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Save')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final name = nameCtrl.text.trim();
    if (name.isEmpty) return;
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .updateCategory(widget.tournamentId, cat.id, {
        'name': name,
        'description':
            descCtrl.text.trim().isNotEmpty ? descCtrl.text.trim() : null,
      });
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _deleteCategory(TournamentCategoryModel cat) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Category'),
        content: Text(
            'Delete "${cat.name}"? Pools in this category will become uncategorised.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(ctx).colorScheme.error),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .deleteCategory(widget.tournamentId, cat.id);
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _assignPool(TournamentPoolModel pool) async {
    String? selected = _categories
            .any((c) => c.pools.any((p) => p.id == pool.id))
        ? _categories.firstWhere((c) => c.pools.any((p) => p.id == pool.id)).id
        : null;

    final result = await showDialog<String?>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('Assign "${pool.name}" to category'),
          content: DropdownButton<String?>(
            value: selected,
            isExpanded: true,
            items: [
              const DropdownMenuItem(value: null, child: Text('No category')),
              for (final cat in _categories)
                DropdownMenuItem(value: cat.id, child: Text(cat.name)),
            ],
            onChanged: (v) => setDialogState(() => selected = v),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            FilledButton(
                onPressed: () => Navigator.pop(ctx, selected ?? ''),
                child: const Text('Assign')),
          ],
        ),
      ),
    );
    if (result == null || !mounted) return;
    try {
      await ref.read(tournamentRepositoryProvider).assignPoolToCategory(
            widget.tournamentId,
            pool.id,
            result.isEmpty ? null : result,
          );
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Categories')),
      floatingActionButton: FloatingActionButton(
        onPressed: _createCategory,
        tooltip: 'Create category',
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_categories.isEmpty)
                        const UiEmptyState(
                            icon: Icons.category_outlined,
                            message: 'No categories yet. Tap + to create one.'),
                      for (final cat in _categories)
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            color: AppThemeTokens.card(context),
                            borderRadius:
                                BorderRadius.circular(AppThemeTokens.radiusMd),
                            border: Border.all(
                                color: AppThemeTokens.border(context)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ListTile(
                                leading: const Icon(Icons.category_outlined),
                                title: Text(cat.name,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600)),
                                subtitle: cat.description != null
                                    ? Text(cat.description!,
                                        style: const TextStyle(fontSize: 12))
                                    : null,
                                trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                          icon: const Icon(Icons.edit_outlined,
                                              size: 18),
                                          tooltip: 'Edit',
                                          onPressed: () => _editCategory(cat)),
                                      IconButton(
                                          icon: const Icon(Icons.delete_outline,
                                              size: 18),
                                          tooltip: 'Delete',
                                          onPressed: () =>
                                              _deleteCategory(cat)),
                                    ]),
                              ),
                              if (cat.pools.isNotEmpty) ...[
                                const Divider(height: 1),
                                Padding(
                                  padding:
                                      const EdgeInsets.fromLTRB(16, 4, 16, 2),
                                  child: Text('Pools',
                                      style: TextStyle(
                                          color:
                                              AppThemeTokens.textMuted(context),
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600)),
                                ),
                                for (final pool in cat.pools)
                                  ListTile(
                                    dense: true,
                                    leading: const Icon(Icons.layers_outlined,
                                        size: 16),
                                    title: Text(pool.name,
                                        style: const TextStyle(fontSize: 13)),
                                    subtitle: Text(
                                        '${pool.teams.length}/${pool.maxTeams} teams'),
                                  ),
                              ],
                              const SizedBox(height: 4),
                            ],
                          ),
                        ),
                      if (_pools.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        UiSectionTitle('Assign Pools to Categories'),
                        const SizedBox(height: 8),
                        for (final pool in _pools)
                          ListTile(
                            leading: const Icon(Icons.layers_outlined),
                            title: Text(pool.name),
                            subtitle: Text(
                              _categories.any((c) =>
                                      c.pools.any((p) => p.id == pool.id))
                                  ? 'Category: ${_categories.firstWhere((c) => c.pools.any((p) => p.id == pool.id)).name}'
                                  : 'No category',
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: OutlinedButton(
                              onPressed: () => _assignPool(pool),
                              child: const Text('Assign'),
                            ),
                          ),
                      ],
                      const SizedBox(height: 80),
                    ],
                  ),
                ),
    );
  }
}

// ===========================================================================
// Edit Tournament Page
// ===========================================================================

class EditTournamentPage extends ConsumerStatefulWidget {
  const EditTournamentPage({
    super.key,
    required this.tournamentId,
    this.tournament,
  });

  final String tournamentId;
  final TournamentModel? tournament;

  @override
  ConsumerState<EditTournamentPage> createState() => _EditTournamentPageState();
}

class _EditTournamentPageState extends ConsumerState<EditTournamentPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _maxTeamsCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _rulesCtrl = TextEditingController();
  final _prizesCtrl = TextEditingController();

  String _sportType = '';
  String _format = 'single_elimination';
  DateTime? _startDate;
  DateTime? _endDate;
  DateTime? _registrationStartDate;
  DateTime? _registrationDeadline;
  bool _useManualBrackets = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final t = widget.tournament;
    if (t != null) {
      _nameCtrl.text = t.name;
      _descCtrl.text = t.description ?? '';
      _maxTeamsCtrl.text = t.maxTeams?.toString() ?? '';
      _locationCtrl.text = t.location ?? t.locationName ?? '';
      _rulesCtrl.text = t.rulesDescription ?? '';
      _prizesCtrl.text = t.prizesDescription ?? '';
      _sportType = t.sportType;
      _format = t.format;
      _startDate = t.startDate;
      _endDate = t.endDate;
      _registrationStartDate = t.registrationStartDate;
      _registrationDeadline = t.registrationDeadline;
      _useManualBrackets = t.useManualBrackets;
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _maxTeamsCtrl.dispose();
    _locationCtrl.dispose();
    _rulesCtrl.dispose();
    _prizesCtrl.dispose();
    super.dispose();
  }

  Future<DateTime?> _pickDate(DateTime? initial, {DateTime? firstDate}) async {
    return showDatePicker(
      context: context,
      initialDate:
          initial ?? (firstDate ?? DateTime.now()).add(const Duration(days: 7)),
      firstDate:
          firstDate ?? DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .updateTournament(widget.tournamentId, {
        'name': _nameCtrl.text.trim(),
        if (_sportType.isNotEmpty) 'sportType': _sportType,
        'format': _format,
        'description':
            _descCtrl.text.trim().isNotEmpty ? _descCtrl.text.trim() : null,
        if (_maxTeamsCtrl.text.trim().isNotEmpty)
          'maxTeams': int.tryParse(_maxTeamsCtrl.text.trim()),
        if (_startDate != null) 'startDate': _startDate!.toIso8601String(),
        if (_endDate != null) 'endDate': _endDate!.toIso8601String(),
        if (_registrationStartDate != null)
          'registrationStartDate': _registrationStartDate!.toIso8601String(),
        if (_registrationDeadline != null)
          'registrationDeadline': _registrationDeadline!.toIso8601String(),
        'location': _locationCtrl.text.trim().isNotEmpty
            ? _locationCtrl.text.trim()
            : null,
        'rulesDescription':
            _rulesCtrl.text.trim().isNotEmpty ? _rulesCtrl.text.trim() : null,
        'prizesDescription':
            _prizesCtrl.text.trim().isNotEmpty ? _prizesCtrl.text.trim() : null,
        'useManualBrackets': _useManualBrackets,
      });
      ref.read(tournamentsNotifierProvider.notifier).reload();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Tournament updated!')));
      context.pop();
    } on Exception catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(extractErrorMessage(error)),
        backgroundColor: Theme.of(context).colorScheme.error,
      ));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _dateTile(
      {required String label,
      required DateTime? value,
      required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InputDecorator(
        decoration: InputDecoration(
            labelText: label,
            prefixIcon: const Icon(Icons.calendar_today_outlined)),
        child: Text(
          value != null ? DateFormat.yMMMd().format(value) : 'Tap to select',
          style: TextStyle(
            color: value == null
                ? AppThemeTokens.textSecondary(context)
                : AppThemeTokens.text(context),
            fontSize: 14,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Tournament')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            UiSectionTitle('Basic Info'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                  labelText: 'Tournament name *',
                  prefixIcon: Icon(Icons.emoji_events_outlined)),
              textCapitalization: TextCapitalization.words,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _sportType.isNotEmpty ? _sportType : null,
              decoration: const InputDecoration(
                  labelText: 'Sport type *',
                  prefixIcon: Icon(Icons.sports_outlined)),
              dropdownColor: AppThemeTokens.cardElevated(context),
              items: kSportTypes
                  .where((s) => s['value']!.isNotEmpty)
                  .map((s) => DropdownMenuItem(
                      value: s['value'], child: Text(s['label']!)))
                  .toList(),
              validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              onChanged: (v) => setState(() => _sportType = v ?? ''),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _format,
              decoration: const InputDecoration(
                  labelText: 'Format *',
                  prefixIcon: Icon(Icons.account_tree_outlined)),
              dropdownColor: AppThemeTokens.cardElevated(context),
              items: const [
                DropdownMenuItem(
                    value: 'single_elimination',
                    child: Text('Single Elimination')),
                DropdownMenuItem(
                    value: 'double_elimination',
                    child: Text('Double Elimination')),
                DropdownMenuItem(
                    value: 'round_robin', child: Text('Round Robin')),
                DropdownMenuItem(
                    value: 'groups_knockout', child: Text('Groups + Knockout')),
              ],
              onChanged: (v) =>
                  setState(() => _format = v ?? 'single_elimination'),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(
                  labelText: 'Description',
                  prefixIcon: Icon(Icons.notes_outlined),
                  alignLabelWithHint: true),
              maxLines: 3,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _maxTeamsCtrl,
              decoration: const InputDecoration(
                  labelText: 'Max teams',
                  prefixIcon: Icon(Icons.group_outlined)),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 24),
            UiSectionTitle('Dates'),
            const SizedBox(height: 8),
            _dateTile(
                label: 'Registration opens',
                value: _registrationStartDate,
                onTap: () async {
                  final d = await _pickDate(_registrationStartDate);
                  if (d != null) setState(() => _registrationStartDate = d);
                }),
            const SizedBox(height: 12),
            _dateTile(
                label: 'Registration deadline',
                value: _registrationDeadline,
                onTap: () async {
                  final d = await _pickDate(_registrationDeadline);
                  if (d != null) setState(() => _registrationDeadline = d);
                }),
            const SizedBox(height: 12),
            _dateTile(
                label: 'Tournament start',
                value: _startDate,
                onTap: () async {
                  final d = await _pickDate(_startDate);
                  if (d != null) setState(() => _startDate = d);
                }),
            const SizedBox(height: 12),
            _dateTile(
                label: 'Tournament end',
                value: _endDate,
                onTap: () async {
                  final d = await _pickDate(_endDate, firstDate: _startDate);
                  if (d != null) setState(() => _endDate = d);
                }),
            const SizedBox(height: 24),
            UiSectionTitle('Location'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _locationCtrl,
              decoration: const InputDecoration(
                  labelText: 'Location / Venue',
                  prefixIcon: Icon(Icons.location_on_outlined)),
            ),
            const SizedBox(height: 24),
            UiSectionTitle('Additional Info'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _rulesCtrl,
              decoration: const InputDecoration(
                  labelText: 'Rules',
                  prefixIcon: Icon(Icons.rule_outlined),
                  alignLabelWithHint: true),
              maxLines: 4,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _prizesCtrl,
              decoration: const InputDecoration(
                  labelText: 'Prizes',
                  prefixIcon: Icon(Icons.card_giftcard_outlined),
                  alignLabelWithHint: true),
              maxLines: 3,
            ),
            const SizedBox(height: 24),
            UiSectionTitle('Settings'),
            SwitchListTile(
              title: const Text('Manual pool/bracket management'),
              subtitle: const Text(
                  'Manually create pools and assign teams instead of auto-generating'),
              value: _useManualBrackets,
              onChanged: (v) => setState(() => _useManualBrackets = v),
            ),
            const SizedBox(height: 28),
            UiPrimaryButton(
              text: 'Save Changes',
              icon: Icons.save_outlined,
              onPressed: _saving ? null : _submit,
              loading: _saving,
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ===========================================================================
// Matches Management Page
// ===========================================================================

class MatchesManagementPage extends ConsumerStatefulWidget {
  const MatchesManagementPage({
    super.key,
    required this.tournamentId,
    required this.tournament,
  });

  final String tournamentId;
  final TournamentModel? tournament;

  @override
  ConsumerState<MatchesManagementPage> createState() =>
      _MatchesManagementPageState();
}

class _MatchesManagementPageState extends ConsumerState<MatchesManagementPage> {
  bool _loading = false;

  List<TournamentMatchModel> get _matches => widget.tournament?.matches ?? [];

  Map<String, List<TournamentMatchModel>> get _matchesByRound {
    final grouped = <String, List<TournamentMatchModel>>{};
    for (final m in _matches) {
      grouped.putIfAbsent(m.round, () => []).add(m);
    }
    return grouped;
  }

  void _refresh() =>
      ref.invalidate(tournamentDetailProvider(widget.tournamentId));

  Future<void> _showMatchDialog({TournamentMatchModel? match}) async {
    final teams = widget.tournament?.teams ?? [];
    String? homeTeamId = match?.teamAId;
    String? awayTeamId = match?.teamBId;
    String? refereeTeamId;
    final scheduledCtrl = TextEditingController(
        text: match?.scheduledAt?.toIso8601String().substring(0, 16) ?? '');
    final locationCtrl = TextEditingController(text: match?.location ?? '');
    final roundCtrl = TextEditingController();

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: Text(match == null ? 'Add Match' : 'Edit Match'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              DropdownButtonFormField<String>(
                value: homeTeamId,
                decoration: const InputDecoration(labelText: 'Home team *'),
                items: teams
                    .map((t) =>
                        DropdownMenuItem(value: t.id, child: Text(t.name)))
                    .toList(),
                onChanged: (v) => setS(() => homeTeamId = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: awayTeamId,
                decoration: const InputDecoration(labelText: 'Away team *'),
                items: teams
                    .map((t) =>
                        DropdownMenuItem(value: t.id, child: Text(t.name)))
                    .toList(),
                onChanged: (v) => setS(() => awayTeamId = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: refereeTeamId,
                decoration:
                    const InputDecoration(labelText: 'Referee team (optional)'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('None')),
                  ...teams.map((t) =>
                      DropdownMenuItem(value: t.id, child: Text(t.name))),
                ],
                onChanged: (v) => setS(() => refereeTeamId = v),
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: roundCtrl,
                  decoration: const InputDecoration(labelText: 'Round number'),
                  keyboardType: TextInputType.number),
              const SizedBox(height: 12),
              TextField(
                  controller: scheduledCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Scheduled (YYYY-MM-DDTHH:mm)')),
              const SizedBox(height: 12),
              TextField(
                  controller: locationCtrl,
                  decoration: const InputDecoration(labelText: 'Location')),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, {
                'homeTeamId': homeTeamId,
                'awayTeamId': awayTeamId,
                if (refereeTeamId != null) 'refereeTeamId': refereeTeamId,
                if (roundCtrl.text.isNotEmpty)
                  'roundNumber': int.tryParse(roundCtrl.text),
                if (scheduledCtrl.text.isNotEmpty)
                  'scheduledAt': scheduledCtrl.text,
                if (locationCtrl.text.isNotEmpty) 'location': locationCtrl.text,
              }),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    ).then((data) async {
      if (data == null) return;
      if (data['homeTeamId'] == null || data['awayTeamId'] == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Home and away teams are required')),
        );
        return;
      }
      setState(() => _loading = true);
      try {
        if (match == null) {
          await ref
              .read(tournamentRepositoryProvider)
              .createMatch(widget.tournamentId, data);
        } else {
          await ref
              .read(tournamentRepositoryProvider)
              .updateMatch(widget.tournamentId, match.id, data);
        }
        _refresh();
      } on Exception catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(extractErrorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ));
        }
      } finally {
        if (mounted) setState(() => _loading = false);
      }
    });
  }

  Future<void> _deleteMatch(TournamentMatchModel match) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Match'),
        content: const Text('Are you sure you want to delete this match?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _loading = true);
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .deleteMatch(widget.tournamentId, match.id);
      _refresh();
    } on Exception catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final byRound = _matchesByRound;

    return Scaffold(
      appBar: AppBar(title: const Text('Matches')),
      floatingActionButton: FloatingActionButton(
        onPressed: _loading ? null : () => _showMatchDialog(),
        tooltip: 'Add match',
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _matches.isEmpty
              ? const UiEmptyState(
                  icon: Icons.sports_outlined,
                  message: 'No matches yet. Tap + to create one.')
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    for (final entry in byRound.entries) ...[
                      UiSectionTitle(
                          entry.key.isEmpty ? 'Unassigned' : entry.key),
                      const SizedBox(height: 8),
                      for (final m in entry.value)
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            color: AppThemeTokens.card(context),
                            borderRadius:
                                BorderRadius.circular(AppThemeTokens.radiusMd),
                            border: Border.all(
                                color: AppThemeTokens.border(context)),
                          ),
                          child: ListTile(
                            title: Text(
                              '${m.teamAName ?? m.teamAId ?? '?'} vs ${m.teamBName ?? m.teamBId ?? '?'}',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w600, fontSize: 14),
                            ),
                            subtitle: m.scheduledAt != null
                                ? Text(
                                    DateFormat.yMMMd()
                                        .add_jm()
                                        .format(m.scheduledAt!.toLocal()),
                                    style: const TextStyle(fontSize: 12))
                                : null,
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                    icon: const Icon(Icons.edit_outlined,
                                        size: 18),
                                    onPressed: () =>
                                        _showMatchDialog(match: m)),
                                IconButton(
                                  icon: Icon(Icons.delete_outline,
                                      size: 18,
                                      color:
                                          Theme.of(context).colorScheme.error),
                                  onPressed: () => _deleteMatch(m),
                                ),
                              ],
                            ),
                          ),
                        ),
                      const SizedBox(height: 8),
                    ],
                    const SizedBox(height: 80),
                  ],
                ),
    );
  }
}
