import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/tournament_repository_impl.dart';
import 'tournament_ui_rules.dart';
import '../state/tournaments_notifier.dart';

const _kAccent = Color(0xFFFF9800);

bool _isTournamentStarted(TournamentModel tournament) {
  return tournament.status == 'in_progress' ||
      tournament.status == 'active' ||
      tournament.status == 'completed';
}

String _statusStageLabel(TournamentModel tournament) {
  if (tournament.status == 'completed') return 'Done';

  if (tournament.status == 'in_progress' || tournament.status == 'active') {
    final hasMatches = tournament.matches.isNotEmpty;
    return hasMatches ? 'In Progress' : 'Forming Brackets';
  }

  if (tournament.status == 'registration') return 'Registration Open';

  final now = DateTime.now();
  final hasRegDates =
      tournament.registrationStartDate != null || tournament.registrationDeadline != null;
  if (hasRegDates) {
    final hasOpened = tournament.registrationStartDate == null ||
        !now.isBefore(tournament.registrationStartDate!);
    final isClosed = tournament.registrationDeadline != null &&
        now.isAfter(tournament.registrationDeadline!);
    if (hasOpened && isClosed) {
      return 'Registration Closed';
    }
  }

  return 'Draft';
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
        final isStarted = _isTournamentStarted(t);
        final isOrganizer = t.creatorId == currentUserId;
        final isAdmin =
            isOrganizer || t.admins.any((a) => a.userId == currentUserId);
        TournamentTeamModel? myTeam;
        if (currentUserId != null && !isOrganizer) {
          for (final team in t.teams) {
            final isMember = team.captainUserId == currentUserId ||
                team.players
                    .any((p) => (p['userId'] as String?) == currentUserId);
            if (isMember) {
              myTeam = team;
              break;
            }
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
          final previousIndex = _tabController.index;
          final clampedIndex =
              previousIndex.clamp(0, tabs.length - 1).toInt();
          _tabController.dispose();
          _tabController = TabController(
            length: tabs.length,
            initialIndex: clampedIndex,
            vsync: this,
          );
        }

        void refresh() {
          ref.invalidate(tournamentDetailProvider(widget.tournamentId));
          ref.invalidate(tournamentsNotifierProvider);
        }

        return Scaffold(
          body: NestedScrollView(
            headerSliverBuilder: (_, __) => [
              SliverAppBar(
                expandedHeight: 80,
                pinned: true,
                title: Text(t.name,
                    style: const TextStyle(fontSize: 16),
                    overflow: TextOverflow.ellipsis),
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    decoration: BoxDecoration(
                      gradient: AppThemeTokens.heroGrad(context),
                    ),
                  ),
                ),
                actions: [
                  if (isAdmin && canEditTournament(t.status))
                    IconButton(
                      icon: const Icon(Icons.edit_outlined),
                      tooltip: 'Edit tournament',
                      onPressed: () async {
                        await context.push('/tournaments/${t.id}/edit', extra: t);
                        if (mounted) refresh();
                      },
                    ),
                  if (isAdmin)
                    IconButton(
                      icon: const Icon(Icons.admin_panel_settings_outlined),
                      tooltip: 'Admin panel',
                      onPressed: () async {
                        await context.push('/tournaments/${t.id}/admins');
                        if (mounted) refresh();
                      },
                    ),
                  if (isOrganizer)
                    PopupMenuButton<String>(
                      icon: const Icon(Icons.more_vert),
                      onSelected: (value) async {
                        if (value == 'cancel') {
                          await _confirmCancelTournament(context, t.id, refresh);
                        } else if (value == 'delete') {
                          await _confirmDeleteTournament(context, t.id);
                        }
                      },
                      itemBuilder: (_) => [
                        if (t.status != 'cancelled' && t.status != 'completed')
                          const PopupMenuItem(
                            value: 'cancel',
                            child: ListTile(
                              leading: Icon(Icons.cancel_outlined),
                              title: Text('Cancel Tournament'),
                              contentPadding: EdgeInsets.zero,
                            ),
                          ),
                        const PopupMenuItem(
                          value: 'delete',
                          child: ListTile(
                            leading: Icon(Icons.delete_forever_outlined),
                            title: Text('Delete Tournament'),
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                      ],
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
                    myTeam: myTeam,
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

  Future<void> _confirmCancelTournament(
      BuildContext context, String tournamentId, VoidCallback onRefresh) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Tournament'),
        content: const Text(
            'Are you sure you want to cancel this tournament? This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Back')),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel Tournament'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await ref.read(tournamentRepositoryProvider).cancelTournament(tournamentId);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Tournament cancelled')));
        onRefresh();
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to cancel: $e')));
      }
    }
  }

  Future<void> _confirmDeleteTournament(
      BuildContext context, String tournamentId) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Tournament'),
        content: const Text(
            'This will permanently delete the tournament and all associated data. This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await ref.read(tournamentRepositoryProvider).deleteTournament(tournamentId);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Tournament deleted')));
        ref.invalidate(tournamentsNotifierProvider);
        context.pop();
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to delete: $e')));
      }
    }
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
  VoidCallback get onRefresh => widget.onRefresh;

  Future<void> _refreshTournamentDetail() async {
    ref.invalidate(tournamentDetailProvider(t.id));
    await ref.read(tournamentDetailProvider(t.id).future);
    ref.invalidate(tournamentsNotifierProvider);
  }

  @override
  Widget build(BuildContext context) {
    final isOrganizer = widget.currentUserId != null && t.creatorId == widget.currentUserId;
    final isCaptain = myTeam?.captainUserId == widget.currentUserId;
    final canRegister = canRegisterTeam(t.status, hasMyTeam: myTeam != null, isOrganizer: isOrganizer);
    final canManageTournament = canManageTournamentAdminActions(t.status);
    final dateFormat = DateFormat.yMMMd();
    final organizerNames = <String>[];

    void addOrganizer(String? name) {
      final clean = (name ?? '').trim();
      if (clean.isEmpty) return;
      final alreadyExists = organizerNames
          .any((existing) => existing.toLowerCase() == clean.toLowerCase());
      if (!alreadyExists) organizerNames.add(clean);
    }

    addOrganizer(t.organizerName);
    for (final admin in t.admins) {
      addOrganizer(admin.userName.isNotEmpty ? admin.userName : admin.userEmail);
    }

    return RefreshIndicator(
      onRefresh: _refreshTournamentDetail,
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
                value: _statusStageLabel(t)),
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
            if (organizerNames.isNotEmpty)
              _InfoRow(
                icon: Icons.groups_outlined,
                label: organizerNames.length > 1 ? 'Organizers' : 'Organizer',
                value: organizerNames.join(', '),
                onTap: () => _showTextDialog(
                  context,
                  organizerNames.length > 1 ? 'Organizers' : 'Organizer',
                  organizerNames.map((name) => '- $name').join('\n'),
                ),
              ),
            if (t.rulesDescription != null || t.prizesDescription != null)
              const Divider(height: 16),
            if (t.hasFee)
              _InfoRow(
                icon: Icons.attach_money_outlined,
                label: 'Entry Fee',
                value: '\$${t.registrationFee!.toStringAsFixed(2)} per team',
              ),
            if (t.rulesDescription != null)
              _InfoRow(
                icon: Icons.gavel_outlined,
                label: 'Rules',
                value: 'Tap to view',
                onTap: () =>
                    _showTextDialog(context, 'Rules', t.rulesDescription!),
              ),
            if (t.prizesDescription != null)
              _InfoRow(
                icon: Icons.workspace_premium_outlined,
                label: 'Prizes',
                value: 'Tap to view',
                onTap: () =>
                    _showTextDialog(context, 'Prizes', t.prizesDescription!),
              ),
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
          if (canRegister) ...[
            const SizedBox(height: 16),
            if (t.hasFee) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                  border: Border.all(color: Colors.orange.withValues(alpha: 0.4)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.attach_money_outlined, color: Colors.orange, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Entry fee: \$${t.registrationFee!.toStringAsFixed(2)} per team — payment details will be provided after registration.',
                        style: const TextStyle(fontSize: 13, color: Colors.orange),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
            UiPrimaryButton(
              text: 'Register My Team',
              icon: Icons.add_circle_outline,
              onPressed: () async {
                final ok =
                    await context.push<bool>('/tournaments/${t.id}/register');
                if (ok == true && context.mounted) {
                  await _refreshTournamentDetail();
                }
              },
            ),
          ],
          if (myTeam case final team?) ...[
            const SizedBox(height: 16),
            _SectionCard(
              title: 'My Team — ${team.name}',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (t.hasFee) ...[
                    _PaymentStatusBadge(status: team.paymentStatus),
                    const SizedBox(height: 8),
                  ],
                  if (isCaptain)
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        OutlinedButton.icon(
                          icon: const Icon(Icons.group_outlined, size: 16),
                          label: const Text('Manage Roster'),
                          onPressed: () => context.push(
                              '/tournaments/${t.id}/teams/${team.id}/roster'),
                        ),
                        if (t.status == 'registration' || t.status == 'draft')
                          OutlinedButton.icon(
                            icon:
                                const Icon(Icons.exit_to_app_outlined, size: 16),
                            label: const Text('Unregister'),
                            style: OutlinedButton.styleFrom(
                                foregroundColor:
                                    Theme.of(context).colorScheme.error),
                            onPressed: () =>
                                _confirmUnregister(context, t.id, onRefresh),
                          ),
                      ],
                    ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          if (t.categories.isNotEmpty)
            for (final cat in t.categories)
              _CategorySection(
                category: cat,
                isAdmin: isAdmin,
                tournament: t,
                canRegister: canRegister,
                myTeam: myTeam,
                onRefresh: onRefresh,
              )
          else if (t.pools.isNotEmpty) ...[
            const UiSectionTitle('Pools'),
            const SizedBox(height: 8),
            for (final pool in t.pools)
              _PoolCard(pool: pool, isAdmin: isAdmin, tournament: t),
          ] else ...[
            const UiSectionTitle('Teams'),
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
            const UiSectionTitle('Admin Controls'),
            const SizedBox(height: 8),
            // Payment management section (only shown when a fee is set)
            if (t.hasFee && t.teams.isNotEmpty) ...[
              _AdminPaymentPanel(
                tournament: t,
                onRefresh: onRefresh,
              ),
              const SizedBox(height: 12),
            ],
            Wrap(spacing: 8, runSpacing: 8, children: [
              OutlinedButton.icon(
                icon: const Icon(Icons.layers_outlined, size: 16),
                label: const Text('Manage Pools'),
                onPressed: canManageTournament
                    ? () async {
                  await context.push('/tournaments/${t.id}/pools');
                  if (context.mounted) onRefresh();
                }
                    : null,
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.category_outlined, size: 16),
                label: const Text('Categories'),
                onPressed: canManageTournament
                    ? () async {
                  await context.push('/tournaments/${t.id}/categories');
                  if (context.mounted) onRefresh();
                }
                    : null,
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.supervisor_account_outlined, size: 16),
                label: const Text('Admins'),
                onPressed: () async {
                  await context.push('/tournaments/${t.id}/admins');
                  if (context.mounted) onRefresh();
                },
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.sports_outlined, size: 16),
                label: const Text('Matches'),
                onPressed: canManageTournament
                    ? () async {
                  await context.push('/tournaments/${t.id}/matches');
                  if (context.mounted) onRefresh();
                }
                    : null,
              ),
              OutlinedButton.icon(
                icon: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(Icons.auto_awesome_outlined, size: 16),
                    if (t.requirePaymentForBrackets && t.unpaidTeamCount > 0)
                      Positioned(
                        right: -6,
                        top: -6,
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: const BoxDecoration(
                            color: Colors.red,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            '${t.unpaidTeamCount}',
                            style: const TextStyle(fontSize: 8, color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                  ],
                ),
                label: const Text('Generate Brackets'),
                onPressed: canManageTournament ? () => _generateBrackets(context, t) : null,
              ),
            ]),
          ],
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  void _showTextDialog(BuildContext context, String title, String content) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: SingleChildScrollView(child: Text(content)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Close'))
        ],
      ),
    );
  }

  Future<void> _confirmUnregister(
      BuildContext context, String tournamentId, VoidCallback onRefresh) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unregister Team'),
        content: const Text(
            'Are you sure you want to unregister your team from this tournament?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Unregister'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .selfUnregisterTeam(tournamentId);
      await _refreshTournamentDetail();
    } on Exception catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(extractErrorMessage(e)),
              backgroundColor: Theme.of(context).colorScheme.error),
        );
      }
    }
  }

  Future<void> _generateBrackets(BuildContext context, TournamentModel tournament) async {
    int? numberOfGroups;
    bool forceGenerate = false;

    // Payment gate warning
    if (tournament.requirePaymentForBrackets && tournament.unpaidTeamCount > 0) {
      final choice = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Unpaid Teams'),
          content: Text(
            '${tournament.unpaidTeamCount} team(s) have not completed payment. '
            'You can wait until all teams pay, or force-generate brackets now.',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            OutlinedButton(
              onPressed: () => Navigator.pop(ctx, 'force'),
              child: const Text('Force Generate'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, 'wait'),
              child: const Text('View Payments'),
            ),
          ],
        ),
      );
      if (!context.mounted) return;
      if (choice == null) return;
      if (choice == 'wait') return; // user chose to review payments first
      if (choice == 'force') forceGenerate = true;
    }

    if (tournament.format == 'groups_knockout') {
      final ctrl = TextEditingController(text: '4');
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Generate Brackets'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('How many groups for the group stage?'),
              const SizedBox(height: 12),
              TextField(
                controller: ctrl,
                decoration: const InputDecoration(labelText: 'Number of groups'),
                keyboardType: TextInputType.number,
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Generate')),
          ],
        ),
      );
      if (ok != true || !context.mounted) return;
      numberOfGroups = int.tryParse(ctrl.text.trim());
    } else {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Generate Brackets'),
          content: const Text('This will automatically create matches for all registered teams. Continue?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Generate')),
          ],
        ),
      );
      if (ok != true || !context.mounted) return;
    }

    try {
      await ref.read(tournamentRepositoryProvider).generateBrackets(
        tournament.id,
        numberOfGroups: numberOfGroups,
        forceGenerate: forceGenerate,
      );
      onRefresh();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Brackets generated!')));
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

}

// ---------------------------------------------------------------------------
// Payment Status Badge
// ---------------------------------------------------------------------------

class _PaymentStatusBadge extends StatelessWidget {
  const _PaymentStatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    Color color;
    IconData icon;
    String label;
    switch (status) {
      case 'paid':
        color = Colors.green;
        icon = Icons.check_circle_outline;
        label = 'Paid';
        break;
      case 'waived':
        color = Colors.blue;
        icon = Icons.do_not_disturb_alt_outlined;
        label = 'Fee Waived';
        break;
      case 'pending':
        color = Colors.orange;
        icon = Icons.schedule_outlined;
        label = 'Payment Pending';
        break;
      default:
        color = Colors.red;
        icon = Icons.money_off_outlined;
        label = 'Unpaid';
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Admin Payment Panel
// ---------------------------------------------------------------------------

class _AdminPaymentPanel extends ConsumerStatefulWidget {
  const _AdminPaymentPanel({
    required this.tournament,
    required this.onRefresh,
  });

  final TournamentModel tournament;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_AdminPaymentPanel> createState() => _AdminPaymentPanelState();
}

class _AdminPaymentPanelState extends ConsumerState<_AdminPaymentPanel> {
  bool _expanded = false;

  Future<void> _setPayment(TournamentTeamModel team, String status) async {
    try {
      await ref.read(tournamentRepositoryProvider).updateTeamPayment(
        widget.tournament.id, team.id, status,
      );
      widget.onRefresh();
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    }
  }

  Future<void> _showPaymentOptions(TournamentTeamModel team) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text(team.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.check_circle_outline, color: Colors.green),
              title: const Text('Mark as Paid'),
              onTap: () => Navigator.pop(ctx, 'paid'),
            ),
            ListTile(
              leading: const Icon(Icons.schedule_outlined, color: Colors.orange),
              title: const Text('Mark as Pending'),
              onTap: () => Navigator.pop(ctx, 'pending'),
            ),
            ListTile(
              leading: const Icon(Icons.do_not_disturb_alt_outlined, color: Colors.blue),
              title: const Text('Waive Fee'),
              onTap: () => Navigator.pop(ctx, 'waived'),
            ),
            ListTile(
              leading: const Icon(Icons.money_off_outlined, color: Colors.red),
              title: const Text('Mark as Unpaid'),
              onTap: () => Navigator.pop(ctx, 'unpaid'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (choice != null) await _setPayment(team, choice);
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tournament;
    final unpaid = t.teams.where((tm) => !tm.isPaid).length;
    final paid = t.teams.where((tm) => tm.isPaid).length;

    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.card(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color: unpaid > 0 ? Colors.orange.withValues(alpha: 0.5) : Colors.green.withValues(alpha: 0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(AppThemeTokens.radiusMd)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: Row(
                children: [
                  Icon(
                    Icons.payments_outlined,
                    size: 18,
                    color: unpaid > 0 ? Colors.orange : Colors.green,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Payments — $paid/${t.teams.length} paid${unpaid > 0 ? ' ($unpaid unpaid)' : ''}',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: unpaid > 0 ? Colors.orange : Colors.green,
                      ),
                    ),
                  ),
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    size: 18,
                    color: AppThemeTokens.textMuted(context),
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            const Divider(height: 1),
            for (final team in t.teams)
              ListTile(
                dense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                leading: Icon(Icons.shield_outlined, size: 16, color: AppThemeTokens.textMuted(context)),
                title: Text(team.name, style: const TextStyle(fontSize: 13)),
                trailing: InkWell(
                  onTap: () => _showPaymentOptions(team),
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    child: _PaymentStatusBadge(status: team.paymentStatus),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _CategorySection extends ConsumerStatefulWidget {
  const _CategorySection({
    required this.category,
    required this.isAdmin,
    required this.tournament,
    required this.canRegister,
    this.myTeam,
    required this.onRefresh,
  });

  final TournamentCategoryModel category;
  final bool isAdmin;
  final TournamentModel tournament;
  final bool canRegister;
  final TournamentTeamModel? myTeam;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_CategorySection> createState() => _CategorySectionState();
}

class _CategorySectionState extends ConsumerState<_CategorySection> {
  TournamentCategoryModel get category => widget.category;
  TournamentModel get tournament => widget.tournament;

  bool _registering = false;

  Future<void> _refreshTournamentDetail() async {
    ref.invalidate(tournamentDetailProvider(tournament.id));
    await ref.read(tournamentDetailProvider(tournament.id).future);
  }

  Future<void> _registerToCategory() async {
    final nameCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Register to ${category.name}'),
        content: TextField(
          controller: nameCtrl,
          decoration: const InputDecoration(
              labelText: 'Team name *',
              prefixIcon: Icon(Icons.shield_outlined)),
          textCapitalization: TextCapitalization.words,
          autofocus: true,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Register')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final name = nameCtrl.text.trim();
    if (name.isEmpty) return;

    setState(() => _registering = true);
    try {
      await ref.read(tournamentRepositoryProvider).selfRegisterTeam(
            tournament.id,
            name,
            categoryId: category.id,
          );
      await _refreshTournamentDetail();
      widget.onRefresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Team registered to ${category.name}!')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(extractErrorMessage(e)),
              backgroundColor: Theme.of(context).colorScheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _registering = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final categoryName = category.name.trim().toLowerCase();
    final poolTeamIds = <String>{
      for (final pool in category.pools)
        for (final team in pool.teams) team.id,
    };
    final unpooledCategoryTeams = tournament.teams.where((team) {
      final inCategoryByName =
          (team.poolName ?? '').trim().toLowerCase() == categoryName;
      final alreadyRenderedInPool = poolTeamIds.contains(team.id);
      return inCategoryByName && !alreadyRenderedInPool;
    }).toList();

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
        if (category.pools.isEmpty && unpooledCategoryTeams.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text('No pools in this category.',
                style: TextStyle(
                    color: AppThemeTokens.textMuted(context), fontSize: 13)),
          )
        else ...[
          if (category.pools.isNotEmpty)
          for (final pool in category.pools)
            _PoolCard(
                pool: pool, isAdmin: widget.isAdmin, tournament: tournament),
          if (unpooledCategoryTeams.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: AppThemeTokens.cardElevated(context),
                borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                border: Border.all(color: AppThemeTokens.border(context)),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Category Teams',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: AppThemeTokens.textSecondary(context),
                      ),
                    ),
                    const SizedBox(height: 4),
                    for (final team in unpooledCategoryTeams)
                      _TeamRow(team: team, tournamentId: tournament.id),
                  ],
                ),
              ),
            ),
        ],
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
                child: Text('${w.position}. ${w.teamName}',
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
                child: Text(team.name, style: const TextStyle(fontSize: 13))),
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
  String get ratioLabel {
    final won = gf ?? 0;
    final lost = ga ?? 0;
    if (lost == 0) {
      if (won == 0) return '0.00';
      return 'INF';
    }
    return (won / lost).toStringAsFixed(2);
  }

  factory _StandingRow.fromStanding(TournamentStandingModel s) => _StandingRow(
      name: s.teamName,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      points: s.points,
      gf: s.goalsFor,
      ga: s.goalsAgainst);
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
          return [];
        }
        return filtered.map(_StandingRow.fromStanding).toList();
      } else {
        return [];
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
            : <_StandingRow>[];
        if (rows.isNotEmpty) {
          children.add(const UiSectionTitle('Other'));
          children.add(const SizedBox(height: 6));
          children.add(_ScoreTable(rows: rows, showGoals: showGF));
          children.add(const SizedBox(height: 16));
        }
      }
    } else {
      final rows = rowsForPool(null);
      if (rows.isEmpty) {
        return const UiEmptyState(
            icon: Icons.leaderboard_outlined, message: 'No scores yet.');
      }
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
                          width: 64,
                          child: Text('Pts Won',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  fontWeight: FontWeight.w600, fontSize: 12))),
                      const SizedBox(
                          width: 64,
                          child: Text('Pts Lost',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  fontWeight: FontWeight.w600, fontSize: 12))),
                      const SizedBox(
                          width: 56,
                          child: Text('Ratio',
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
                          width: 64,
                          child: Text('${sorted[i].gf ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 13))),
                      SizedBox(
                          width: 64,
                          child: Text('${sorted[i].ga ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 13))),
                      SizedBox(
                          width: 56,
                          child: Text(sorted[i].ratioLabel,
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 13))),
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
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
      }
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
    final canSubmit = m.status == 'in_progress' || m.status == 'scheduled';

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

  IconData _icon() {
    switch (status) {
      case 'completed':
        return Icons.check_circle_outline;
      case 'in_progress':
        return Icons.play_circle_outline;
      case 'cancelled':
        return Icons.cancel_outlined;
      case 'registration':
        return Icons.app_registration_outlined;
      default:
        return Icons.edit_note_outlined;
    }
  }

  Color _statusColor() {
    switch (status) {
      case 'completed':
        return AppThemeTokens.success;
      case 'in_progress':
      case 'active':
        return AppThemeTokens.info;
      case 'cancelled':
        return AppThemeTokens.error;
      case 'registration':
        return AppThemeTokens.warning;
      default:
        return AppThemeTokens.primary500;
    }
  }

  Color _statusBgColor() {
    switch (status) {
      case 'completed':
        return AppThemeTokens.successBg;
      case 'in_progress':
      case 'active':
        return AppThemeTokens.infoBg;
      case 'cancelled':
        return AppThemeTokens.errorBg;
      case 'registration':
        return AppThemeTokens.warningBg;
      default:
        return AppThemeTokens.primaryGlow;
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor();
    final bgColor = _statusBgColor();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: statusColor.withValues(alpha: 0.3))),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_icon(), size: 12, color: statusColor),
          const SizedBox(width: 4),
          Text(status.replaceAll('_', ' '),
              style: TextStyle(
                  color: statusColor,
                  fontSize: 11,
                  fontWeight: FontWeight.w600)),
        ],
      ),
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
      {required this.icon,
      required this.label,
      required this.value,
      this.onTap});

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Padding(
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
          if (onTap != null)
            Icon(Icons.chevron_right,
                size: 16, color: AppThemeTokens.textMuted(context)),
        ],
      ),
    );
    if (onTap != null) {
      return InkWell(
          onTap: onTap, borderRadius: BorderRadius.circular(4), child: row);
    }
    return row;
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

// ===========================================================================
// Register Team Page
// ===========================================================================
