import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/tournament_repository_impl.dart';
import '../state/tournaments_notifier.dart';
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
        final matches = tournament.matches;
        final byRound = _matchesByRound(matches);
        return Scaffold(
          appBar: AppBar(title: const Text('Matches')),
          floatingActionButton: FloatingActionButton(
            onPressed: _loading ? null : () => _showMatchDialog(tournament),
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
                            onEdit: () => _showMatchDialog(tournament, match: m),
                            onScore: () => _showScoreDialog(m),
                            onDelete: () => _deleteMatch(m),
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
  });

  final TournamentMatchModel match;
  final VoidCallback onEdit;
  final VoidCallback onScore;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final m = match;
    final hasScore = m.scoreA != null && m.scoreB != null;
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
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
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
