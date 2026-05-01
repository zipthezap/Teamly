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


class PoolsManagementPage extends ConsumerStatefulWidget {
  const PoolsManagementPage({super.key, required this.tournamentId});
  final String tournamentId;

  @override
  ConsumerState<PoolsManagementPage> createState() => _PoolsManagementPageState();
}

class _PoolsManagementPageState extends ConsumerState<PoolsManagementPage> {
  List<TournamentPoolModel> _pools = [];
  List<TournamentTeamModel> _allTeams = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        ref.read(tournamentRepositoryProvider).getPools(widget.tournamentId),
        ref.read(tournamentRepositoryProvider).getTournament(widget.tournamentId).then((t) => t.teams),
      ]);
      if (mounted) setState(() {
        _pools = results[0] as List<TournamentPoolModel>;
        _allTeams = results[1] as List<TournamentTeamModel>;
        _loading = false;
      });
    } on Exception catch (e) {
      if (mounted) setState(() { _error = extractErrorMessage(e); _loading = false; });
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
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Pool name *'), textCapitalization: TextCapitalization.words),
            const SizedBox(height: 12),
            TextField(controller: maxCtrl, decoration: const InputDecoration(labelText: 'Max teams *'), keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Description (optional)')),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final name = nameCtrl.text.trim();
    final maxTeams = int.tryParse(maxCtrl.text.trim());
    if (name.isEmpty || maxTeams == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pool name and max teams are required')));
      return;
    }
    try {
      await ref.read(tournamentRepositoryProvider).createPool(widget.tournamentId, {
        'name': name, 'maxTeams': maxTeams,
        if (descCtrl.text.trim().isNotEmpty) 'description': descCtrl.text.trim(),
      });
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: Theme.of(context).colorScheme.error));
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
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Pool name *'), textCapitalization: TextCapitalization.words),
          const SizedBox(height: 12),
          TextField(controller: maxCtrl, decoration: const InputDecoration(labelText: 'Max teams *'), keyboardType: TextInputType.number),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final name = nameCtrl.text.trim();
    final maxTeams = int.tryParse(maxCtrl.text.trim());
    if (name.isEmpty || maxTeams == null) return;
    try {
      await ref.read(tournamentRepositoryProvider).updatePool(widget.tournamentId, pool.id, {'name': name, 'maxTeams': maxTeams});
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _deletePool(TournamentPoolModel pool) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Pool'),
        content: Text('Delete "${pool.name}"? This cannot be undone. All teams must be removed first.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error), onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(tournamentRepositoryProvider).deletePool(widget.tournamentId, pool.id);
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _removeTeam(String poolId, TournamentTeamModel team) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Team'),
        content: Text('Remove "${team.name}" from this pool?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error), onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(tournamentRepositoryProvider).removeTeamFromPool(widget.tournamentId, poolId, team.id);
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _removeFromWaitlist(String poolId, TournamentWaitlistEntryModel waitlistEntry) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove from Waitlist'),
        content: Text('Remove "${waitlistEntry.teamName}" from the waitlist?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error), onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(tournamentRepositoryProvider).removeTeamFromWaitlist(widget.tournamentId, poolId, waitlistEntry.teamId);
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _addTeamToPool(TournamentPoolModel pool) async {
    final poolTeamIds = pool.teams.map((t) => t.id).toSet();
    final unassigned = _allTeams.where((t) => !poolTeamIds.contains(t.id)).toList();
    if (unassigned.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No unassigned teams available')));
      return;
    }

    TournamentTeamModel? selected;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: Text('Add Team to ${pool.name}'),
          content: DropdownButtonFormField<TournamentTeamModel>(
            value: selected,
            decoration: const InputDecoration(labelText: 'Select team'),
            items: unassigned
                .map((t) => DropdownMenuItem(value: t, child: Text(t.name)))
                .toList(),
            onChanged: (v) => setS(() => selected = v),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: selected != null ? () => Navigator.pop(ctx, true) : null,
              child: const Text('Add'),
            ),
          ],
        ),
      ),
    );
    if (ok != true || selected == null || !mounted) return;
    try {
      await ref.read(tournamentRepositoryProvider).registerTeamToPool(widget.tournamentId, pool.id, selected!.id);
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: Theme.of(context).colorScheme.error));
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
                      ? const UiEmptyState(icon: Icons.layers_outlined, message: 'No pools yet. Tap + to create one.')
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _pools.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, i) {
                            final pool = _pools[i];
                            return Container(
                              decoration: BoxDecoration(
                                color: AppThemeTokens.card(context),
                                borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                                border: Border.all(color: AppThemeTokens.border(context)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ListTile(
                                    leading: const Icon(Icons.layers_outlined),
                                    title: Text(pool.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                    subtitle: Text('${pool.teams.length}/${pool.maxTeams} teams${pool.waitlist.isNotEmpty ? ' · ${pool.waitlist.length} waiting' : ''}'),
                                    trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                                      IconButton(icon: const Icon(Icons.person_add_outlined, size: 18), tooltip: 'Add team', onPressed: () => _addTeamToPool(pool)),
                                      IconButton(icon: const Icon(Icons.edit_outlined, size: 18), tooltip: 'Edit', onPressed: () => _editPool(pool)),
                                      IconButton(icon: const Icon(Icons.delete_outline, size: 18), tooltip: 'Delete', onPressed: () => _deletePool(pool)),
                                    ]),
                                  ),
                                  if (pool.teams.isNotEmpty) ...[
                                    const Divider(height: 1),
                                    for (final team in pool.teams)
                                      ListTile(
                                        dense: true,
                                        leading: const Icon(Icons.shield_outlined, size: 16),
                                        title: Text(team.name, style: const TextStyle(fontSize: 13)),
                                        trailing: IconButton(
                                          icon: const Icon(Icons.person_remove_outlined, size: 16),
                                          tooltip: 'Remove from pool',
                                          onPressed: () => _removeTeam(pool.id, team),
                                        ),
                                      ),
                                  ],
                                  if (pool.waitlist.isNotEmpty) ...[
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 2),
                                      child: Text('Waitlist', style: TextStyle(color: AppThemeTokens.textMuted(context), fontSize: 12, fontWeight: FontWeight.w600)),
                                    ),
                                    for (final w in pool.waitlist)
                                      ListTile(
                                        dense: true,
                                        leading: Text('${w.position}.', style: TextStyle(color: AppThemeTokens.textMuted(context))),
                                        title: Text(w.teamName, style: TextStyle(color: AppThemeTokens.textSecondary(context), fontSize: 13)),
                                        trailing: IconButton(
                                          icon: Icon(Icons.remove_circle_outline, size: 16, color: Theme.of(context).colorScheme.error),
                                          tooltip: 'Remove from waitlist',
                                          onPressed: () => _removeFromWaitlist(pool.id, w),
                                        ),
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

