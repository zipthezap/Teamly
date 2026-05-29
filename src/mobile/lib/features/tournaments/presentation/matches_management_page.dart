import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/tournament_repository_impl.dart';
import '../state/tournaments_notifier.dart';
import 'tournament_ui_rules.dart';
import 'tournament_detail_page.dart' show ScoreDialog;


class MatchesManagementPage extends ConsumerStatefulWidget {
  const MatchesManagementPage({
    super.key,
    required this.tournamentId,
  });

  final String tournamentId;

  @override
  ConsumerState<MatchesManagementPage> createState() => _MatchesManagementPageState();
}

class _MatchesManagementPageState extends ConsumerState<MatchesManagementPage> {
  bool _loading = false;

  Map<String, List<TournamentMatchModel>> _matchesByRound(List<TournamentMatchModel> matches) {
    final grouped = <String, List<TournamentMatchModel>>{};
    for (final m in matches) {
      grouped.putIfAbsent(m.round, () => []).add(m);
    }
    return grouped;
  }

  void _refresh() {
    ref.invalidate(tournamentDetailProvider(widget.tournamentId));
    ref.invalidate(tournamentsNotifierProvider);
  }

  Future<void> _showMatchDialog(TournamentModel tournament, {TournamentMatchModel? match}) async {
    final teams = tournament.teams;
    String? homeTeamId = match?.teamAId;
    String? awayTeamId = match?.teamBId;
    String? refereeTeamId;
    final scheduledCtrl = TextEditingController(text: match?.scheduledAt?.toIso8601String().substring(0, 16) ?? '');
    final locationCtrl = TextEditingController(text: match?.location ?? '');
    // Pre-populate round number if available from the current match's raw round label
    final roundCtrl = TextEditingController(
      text: match != null
          ? (RegExp(r'\d+').firstMatch(match.round)?.group(0) ?? '')
          : '',
    );

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
                items: teams.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))).toList(),
                onChanged: (v) => setS(() => homeTeamId = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: awayTeamId,
                decoration: const InputDecoration(labelText: 'Away team *'),
                items: teams.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))).toList(),
                onChanged: (v) => setS(() => awayTeamId = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: refereeTeamId,
                decoration: const InputDecoration(labelText: 'Referee team (optional)'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('None')),
                  ...teams.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))),
                ],
                onChanged: (v) => setS(() => refereeTeamId = v),
              ),
              const SizedBox(height: 12),
              TextField(controller: roundCtrl, decoration: const InputDecoration(labelText: 'Round number'), keyboardType: TextInputType.number),
              const SizedBox(height: 12),
              TextField(controller: scheduledCtrl, decoration: const InputDecoration(labelText: 'Scheduled (YYYY-MM-DDTHH:mm)')),
              const SizedBox(height: 12),
              TextField(controller: locationCtrl, decoration: const InputDecoration(labelText: 'Location')),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, {
                'homeTeamId': homeTeamId,
                'awayTeamId': awayTeamId,
                if (refereeTeamId != null) 'refereeTeamId': refereeTeamId,
                if (roundCtrl.text.isNotEmpty) 'roundNumber': int.tryParse(roundCtrl.text),
                if (scheduledCtrl.text.isNotEmpty) 'scheduledAt': scheduledCtrl.text,
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
          await ref.read(tournamentRepositoryProvider).createMatch(widget.tournamentId, data);
        } else {
          await ref.read(tournamentRepositoryProvider).updateMatch(widget.tournamentId, match.id, data);
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

  Future<void> _showScoreDialog(TournamentMatchModel match) async {
    final result = await showDialog<Map<String, int>>(
      context: context,
      builder: (ctx) => ScoreDialog(
        homeTeamName: match.teamAName ?? 'Home',
        awayTeamName: match.teamBName ?? 'Away',
        initialHomeScore: match.scoreA,
        initialAwayScore: match.scoreB,
      ),
    );
    if (result == null || !mounted) return;
    setState(() => _loading = true);
    try {
      // Admins always use the PUT endpoint which handles both initial and retroactive scores
      await ref.read(tournamentRepositoryProvider).adminUpdateScore(
            widget.tournamentId,
            match.id,
            homeScore: result['home']!,
            awayScore: result['away']!,
          );
      _refresh();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Score updated!')));
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _deleteMatch(TournamentMatchModel match) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Match'),
        content: const Text('Are you sure you want to delete this match?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _loading = true);
    try {
      await ref.read(tournamentRepositoryProvider).deleteMatch(widget.tournamentId, match.id);
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

  Future<void> _startMatch(TournamentMatchModel match) async {
    setState(() => _loading = true);
    try {
      await ref.read(tournamentRepositoryProvider).startMatch(widget.tournamentId, match.id);
      _refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Match started')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _assignReferee(TournamentModel tournament, TournamentMatchModel match) async {
    String? refereeTeamId = match.refereeTeamId;
    final teams = tournament.teams;
    final payload = await showDialog<String?>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: const Text('Assign Referee Team'),
          content: DropdownButtonFormField<String?>(
            value: refereeTeamId,
            decoration: const InputDecoration(labelText: 'Referee team'),
            items: [
              const DropdownMenuItem<String?>(value: null, child: Text('None')),
              ...teams.map((t) => DropdownMenuItem<String?>(value: t.id, child: Text(t.name))),
            ],
            onChanged: (v) => setS(() => refereeTeamId = v),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, refereeTeamId), child: const Text('Save')),
          ],
        ),
      ),
    );
    if (!mounted) return;
    if (payload == null && match.refereeTeamId == null) return;

    setState(() => _loading = true);
    try {
      await ref.read(tournamentRepositoryProvider).assignReferee(widget.tournamentId, match.id, payload);
      _refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Referee updated')));
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _assignScorekeeper(TournamentMatchModel match) async {
    final userIdCtrl = TextEditingController(text: match.scorekeeperUserId ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Assign Scorekeeper'),
        content: TextField(
          controller: userIdCtrl,
          decoration: const InputDecoration(
            labelText: 'Scorekeeper User ID',
            helperText: 'Leave empty to clear assignment',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    setState(() => _loading = true);
    try {
      final userId = userIdCtrl.text.trim();
      await ref.read(tournamentRepositoryProvider).assignScorekeeper(
            widget.tournamentId,
            match.id,
            userId.isEmpty ? null : userId,
          );
      _refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Scorekeeper updated')));
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createIncident(TournamentMatchModel match) async {
    final typeCtrl = TextEditingController();
    final descriptionCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Report Incident'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: typeCtrl,
                decoration: const InputDecoration(
                  labelText: 'Incident type (optional)',
                  hintText: 'injury, misconduct, equipment, weather...',
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: descriptionCtrl,
                minLines: 3,
                maxLines: 6,
                decoration: const InputDecoration(labelText: 'Description *'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Submit')),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    final description = descriptionCtrl.text.trim();
    if (description.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Description is required')),
      );
      return;
    }

    setState(() => _loading = true);
    try {
      await ref.read(tournamentRepositoryProvider).createMatchIncident(
            widget.tournamentId,
            match.id,
            incidentType: typeCtrl.text.trim().isEmpty ? null : typeCtrl.text.trim(),
            description: description,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Incident reported')));
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _viewIncidents(TournamentMatchModel match) async {
    setState(() => _loading = true);
    try {
      final incidents =
          await ref.read(tournamentRepositoryProvider).getMatchIncidents(widget.tournamentId, match.id);
      if (!mounted) return;

      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (ctx) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: incidents.isEmpty
                ? const SizedBox(
                    height: 120,
                    child: Center(child: Text('No incidents reported for this match')),
                  )
                : ListView.separated(
                    shrinkWrap: true,
                    itemCount: incidents.length,
                    separatorBuilder: (_, __) => const Divider(height: 16),
                    itemBuilder: (_, i) {
                      final incident = incidents[i];
                      final status = (incident['status'] ?? '').toString();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            (incident['incidentType'] ?? 'other').toString(),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 4),
                          Text((incident['description'] ?? '').toString()),
                          const SizedBox(height: 6),
                          Text('Status: $status'),
                          if (status == 'open')
                            Align(
                              alignment: Alignment.centerRight,
                              child: TextButton(
                                onPressed: () async {
                                  await ref.read(tournamentRepositoryProvider).resolveMatchIncident(
                                        widget.tournamentId,
                                        incident['id'].toString(),
                                        status: 'resolved',
                                      );
                                  if (ctx.mounted) Navigator.pop(ctx);
                                },
                                child: const Text('Resolve'),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
          ),
        ),
      );
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showQrCheckInTools(TournamentModel tournament) async {
    String? teamId = tournament.teams.isNotEmpty ? tournament.teams.first.id : null;
    final checkInTokenCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: const Text('QR Check-In Tools'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Generate token for team'),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: teamId,
                  items: tournament.teams
                      .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                      .toList(),
                  onChanged: (v) => setS(() => teamId = v),
                ),
                const SizedBox(height: 8),
                FilledButton.tonal(
                  onPressed: teamId == null
                      ? null
                      : () async {
                          final response = await ref
                              .read(tournamentRepositoryProvider)
                              .generateCheckInQrToken(widget.tournamentId, teamId!);
                          if (!ctx.mounted) return;
                          final token = (response['checkInToken'] ?? '').toString();
                          await showDialog<void>(
                            context: ctx,
                            builder: (_) => AlertDialog(
                              title: const Text('Check-In Token'),
                              content: SelectableText(token),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(_, true),
                                  child: const Text('Close'),
                                ),
                              ],
                            ),
                          );
                        },
                  child: const Text('Generate Token'),
                ),
                const Divider(height: 20),
                TextField(
                  controller: checkInTokenCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Check-in token',
                    hintText: 'Paste scanned QR token',
                  ),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: () async {
                    final token = checkInTokenCtrl.text.trim();
                    if (token.isEmpty) return;
                    await ref.read(tournamentRepositoryProvider).checkInViaQrToken(widget.tournamentId, token);
                    if (!ctx.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Team checked in successfully')),
                    );
                    Navigator.pop(ctx);
                  },
                  child: const Text('Check In Team'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
          ],
        ),
      ),
    );
  }

  Future<void> _autoAssignReferees(TournamentModel tournament) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Auto-assign Referees'),
        content: const Text(
          'This will assign teams on break as referees for all matches that '
          'don\'t yet have one, prioritising teams with the fewest duties so '
          'that referee workload stays fair. Continue?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Assign')),
        ],
      ),
    );
    if (confirm != true || !mounted) return;

    final unassignedBefore = tournament.matches
        .where((m) => m.status != 'cancelled' && m.refereeTeamId == null)
        .length;

    setState(() => _loading = true);
    try {
      final result = await ref
          .read(tournamentRepositoryProvider)
          .autoAssignReferees(widget.tournamentId);
      _refresh();
      if (mounted) {
        final assigned = (result['assigned'] as num?)?.toInt() ?? 0;
        final remaining = (unassignedBefore - assigned).clamp(0, unassignedBefore);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$assigned match(es) assigned a referee')),
        );
        if (remaining > 0) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                '$remaining match(es) are still missing referees. '
                'Assign manually or adjust schedule overlap so more teams are available.',
              ),
              backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
            ),
          );
        }
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showRefereeDuties() async {
    setState(() => _loading = true);
    List<RefereeDutyModel> duties = [];
    try {
      duties = await ref
          .read(tournamentRepositoryProvider)
          .getRefereeDuties(widget.tournamentId);
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Referee Duties', style: Theme.of(ctx).textTheme.titleMedium),
              const SizedBox(height: 4),
              const Text(
                'Shows how many times each team has been assigned to referee a match.',
                style: TextStyle(fontSize: 12),
              ),
              const SizedBox(height: 12),
              if (duties.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Text('No referee assignments yet'),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: duties.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final d = duties[i];
                    return ListTile(
                      dense: true,
                      leading: CircleAvatar(
                        radius: 16,
                        child: Text('${d.dutyCount}', style: const TextStyle(fontSize: 12)),
                      ),
                      title: Text(d.teamName),
                      trailing: Text(
                        d.dutyCount == 1 ? '1 duty' : '${d.dutyCount} duties',
                        style: const TextStyle(fontSize: 12),
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tournamentAsync = ref.watch(tournamentDetailProvider(widget.tournamentId));

    return tournamentAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('Matches')),
        body: ErrorDisplay(
          message: extractErrorMessage(error),
          onRetry: _refresh,
        ),
      ),
      data: (tournament) {
        final authState = ref.watch(authNotifierProvider);
        final currentUserId = authState.user?.id ?? '';
        final isCreator = tournament.creatorId == currentUserId;
        final isAdmin = tournament.admins.any((a) => a.userId == currentUserId);
        final canManageReferees = isCreator || isAdmin;
        final matches = tournament.matches;
        final byRound = _matchesByRound(matches);
        final canManageStructure =
            !_loading && canManageTournamentAdminActions(tournament.status);
        return Scaffold(
          appBar: AppBar(
            title: const Text('Matches'),
            actions: [
              if (tournament.selfRefEnabled && canManageReferees)
                IconButton(
                  icon: const Icon(Icons.assignment_ind_outlined),
                  tooltip: 'Auto-assign referees',
                  onPressed: _loading ? null : () => _autoAssignReferees(tournament),
                ),
              if (tournament.selfRefEnabled)
                IconButton(
                  icon: const Icon(Icons.bar_chart_outlined),
                  tooltip: 'Referee duties',
                  onPressed: () => _showRefereeDuties(),
                ),
              IconButton(
                icon: const Icon(Icons.qr_code_2_outlined),
                tooltip: 'QR check-in tools',
                onPressed: () => _showQrCheckInTools(tournament),
              ),
            ],
          ),
          floatingActionButton: FloatingActionButton(
            onPressed: canManageStructure ? () => _showMatchDialog(tournament) : null,
            tooltip: 'Add match',
            child: const Icon(Icons.add),
          ),
          body: _loading
              ? const Center(child: CircularProgressIndicator())
              : matches.isEmpty
                  ? const UiEmptyState(icon: Icons.sports_outlined, message: 'No matches yet. Tap + to create one.')
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        for (final entry in byRound.entries) ...[
                          UiSectionTitle(entry.key.isEmpty ? 'Unassigned' : entry.key),
                          const SizedBox(height: 8),
                            for (final m in entry.value) _MatchManagementTile(
                              match: m,
                              onEdit: canManageStructure
                                  ? () => _showMatchDialog(tournament, match: m)
                                  : null,
                              onScore: () => _showScoreDialog(m),
                              onDelete: canManageStructure ? () => _deleteMatch(m) : null,
                              onStart: () => _startMatch(m),
                              onAssignReferee: canManageStructure
                                  ? () => _assignReferee(tournament, m)
                                  : null,
                              onAssignScorekeeper: canManageStructure
                                  ? () => _assignScorekeeper(m)
                                  : null,
                              onReportIncident: () => _createIncident(m),
                              onViewIncidents: () => _viewIncidents(m),
                              currentUserId: currentUserId,
                            ),
                          const SizedBox(height: 8),
                        ],
                        const SizedBox(height: 80),
                      ],
                    ),
        );
      },
    );
  }
}

class _MatchManagementTile extends StatelessWidget {
  const _MatchManagementTile({
    required this.match,
    required this.onEdit,
    required this.onScore,
    required this.onDelete,
    required this.onStart,
    required this.onAssignReferee,
    required this.onAssignScorekeeper,
    required this.onReportIncident,
    required this.onViewIncidents,
    required this.currentUserId,
  });

  final TournamentMatchModel match;
  final VoidCallback? onEdit;
  final VoidCallback onScore;
  final VoidCallback? onDelete;
  final VoidCallback onStart;
  final VoidCallback? onAssignReferee;
  final VoidCallback? onAssignScorekeeper;
  final VoidCallback onReportIncident;
  final VoidCallback onViewIncidents;
  final String currentUserId;

  @override
  Widget build(BuildContext context) {
    final m = match;
    final hasScore = m.scoreA != null && m.scoreB != null;
    final showStartControl = m.status == 'scheduled' || m.status == 'in_progress';
    final isAssignedScorekeeper = m.scorekeeperUserId == currentUserId;
    // Scheduled matches can always be started; already-live matches only expose
    // the action to the assigned scorekeeper context.
    final canStartByCurrentUser = m.status == 'scheduled' || (m.status == 'in_progress' && isAssignedScorekeeper);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppThemeTokens.card(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${m.teamAName ?? m.teamAId ?? '?'} vs ${m.teamBName ?? m.teamBId ?? '?'}',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ),
                if (hasScore)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppThemeTokens.primaryGlow,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${m.scoreA} – ${m.scoreB}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: AppThemeTokens.primary400,
                      ),
                    ),
                  ),
              ],
            ),
            if (m.scheduledAt != null) ...[
              const SizedBox(height: 2),
              Text(
                DateFormat.yMMMd().add_jm().format(m.scheduledAt!.toLocal()),
                style: TextStyle(fontSize: 12, color: AppThemeTokens.textMuted(context)),
              ),
            ],
            if (m.refereeTeamName != null || m.scorekeeperUserName != null) ...[
              const SizedBox(height: 4),
              Text(
                [
                  if (m.refereeTeamName != null) 'Referee: ${m.refereeTeamName}',
                  if (m.scorekeeperUserName != null) 'Scorekeeper: ${m.scorekeeperUserName}',
                ].join(' • '),
                style: TextStyle(fontSize: 12, color: AppThemeTokens.textMuted(context)),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (showStartControl)
                  OutlinedButton.icon(
                    icon: Icon(
                      m.status == 'in_progress' ? Icons.play_circle : Icons.play_arrow,
                      size: 16,
                    ),
                    label: Text(
                      m.status == 'in_progress' ? 'Live' : 'Start',
                      style: const TextStyle(fontSize: 12),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    onPressed: canStartByCurrentUser ? onStart : null,
                  ),
                if (showStartControl) const SizedBox(width: 8),
                OutlinedButton.icon(
                  icon: Icon(hasScore ? Icons.edit_note : Icons.sports_score_outlined, size: 16),
                  label: Text(hasScore ? 'Edit Score' : 'Set Score', style: const TextStyle(fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  onPressed: onScore,
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  tooltip: 'Edit match',
                  onPressed: onEdit,
                  visualDensity: VisualDensity.compact,
                ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_horiz, size: 18),
                  onSelected: (value) {
                    switch (value) {
                      case 'assign_referee':
                        onAssignReferee?.call();
                        break;
                      case 'assign_scorekeeper':
                        onAssignScorekeeper?.call();
                        break;
                      case 'report_incident':
                        onReportIncident();
                        break;
                      case 'view_incidents':
                        onViewIncidents();
                        break;
                    }
                  },
                  itemBuilder: (ctx) => [
                    const PopupMenuItem(
                      value: 'assign_referee',
                      child: Text('Assign referee team'),
                    ),
                    const PopupMenuItem(
                      value: 'assign_scorekeeper',
                      child: Text('Assign scorekeeper'),
                    ),
                    const PopupMenuItem(
                      value: 'report_incident',
                      child: Text('Report incident'),
                    ),
                    const PopupMenuItem(
                      value: 'view_incidents',
                      child: Text('View incidents'),
                    ),
                  ],
                ),
                IconButton(
                  icon: Icon(Icons.delete_outline, size: 18, color: Theme.of(context).colorScheme.error),
                  tooltip: 'Delete match',
                  onPressed: onDelete,
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
