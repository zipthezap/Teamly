import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/tournament_repository_impl.dart';
import '../state/tournaments_notifier.dart';

/// Organizer game-day operations hub.
///
/// Surfaces:
/// - Share / portal token management
/// - Team check-in list with manual check-in
/// - Tournament-level incident log
/// - Quick links to analytics
class TournamentOperationsPage extends ConsumerStatefulWidget {
  const TournamentOperationsPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  ConsumerState<TournamentOperationsPage> createState() =>
      _TournamentOperationsPageState();
}

class _TournamentOperationsPageState
    extends ConsumerState<TournamentOperationsPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  void _refresh() {
    ref.invalidate(tournamentDetailProvider(widget.tournamentId));
  }

  @override
  Widget build(BuildContext context) {
    final tournamentAsync =
        ref.watch(tournamentDetailProvider(widget.tournamentId));

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Operations Hub'),
        leading: BackButton(onPressed: () => context.pop()),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            tooltip: 'Refresh',
            onPressed: _refresh,
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(icon: Icon(Icons.how_to_reg_outlined), text: 'Check-in'),
            Tab(icon: Icon(Icons.share_outlined), text: 'Share'),
            Tab(icon: Icon(Icons.warning_amber_outlined), text: 'Incidents'),
          ],
        ),
      ),
      body: tournamentAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(message: e.toString()),
        data: (tournament) => TabBarView(
          controller: _tabs,
          children: [
            _CheckInTab(tournament: tournament, onRefresh: _refresh),
            _ShareTab(tournament: tournament, onRefresh: _refresh),
            _IncidentsTab(tournament: tournament),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Check-in tab
// ---------------------------------------------------------------------------

class _CheckInTab extends ConsumerStatefulWidget {
  const _CheckInTab({required this.tournament, required this.onRefresh});

  final TournamentModel tournament;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_CheckInTab> createState() => _CheckInTabState();
}

class _CheckInTabState extends ConsumerState<_CheckInTab> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final teams = widget.tournament.teams;
    final filtered = _search.isEmpty
        ? teams
        : teams
            .where((t) =>
                t.name.toLowerCase().contains(_search.toLowerCase()))
            .toList();

    final checkedIn = teams.where((t) => t.checkedIn).length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _ProgressRow(
                label: 'Checked in',
                done: checkedIn,
                total: teams.length,
                color: AppThemeTokens.success,
              ),
              const SizedBox(height: 10),
              TextField(
                decoration: InputDecoration(
                  hintText: 'Search teams…',
                  prefixIcon: const Icon(Icons.search, size: 18),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  isDense: true,
                ),
                onChanged: (v) => setState(() => _search = v),
              ),
            ],
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('No teams found'))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 6),
                  itemBuilder: (context, i) => _CheckInTile(
                    team: filtered[i],
                    tournamentId: widget.tournament.id,
                    onRefresh: widget.onRefresh,
                  ),
                ),
        ),
      ],
    );
  }
}

class _CheckInTile extends ConsumerStatefulWidget {
  const _CheckInTile({
    required this.team,
    required this.tournamentId,
    required this.onRefresh,
  });

  final TournamentTeamModel team;
  final String tournamentId;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_CheckInTile> createState() => _CheckInTileState();
}

class _CheckInTileState extends ConsumerState<_CheckInTile> {
  bool _loading = false;

  Future<void> _checkIn() async {
    setState(() => _loading = true);
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .checkInTeam(widget.tournamentId, widget.team.id);
      widget.onRefresh();
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(extractErrorMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showQrToken() async {
    try {
      final result = await ref
          .read(tournamentRepositoryProvider)
          .generateCheckInQrToken(widget.tournamentId, widget.team.id);
      if (!mounted) return;
      final token = result['checkInToken'] as String? ?? '';
      showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Check-in Token — ${widget.team.name}'),
          content: SelectableText(
            token,
            style: const TextStyle(
                fontFamily: 'monospace', fontWeight: FontWeight.bold),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: token));
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Token copied to clipboard')),
                );
              },
              child: const Text('Copy'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(extractErrorMessage(e))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.team;
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: t.checkedIn
              ? AppThemeTokens.successBg
              : AppThemeTokens.cardElevated(context),
          child: Icon(
            t.checkedIn
                ? Icons.check_circle_outline
                : Icons.radio_button_unchecked_outlined,
            color: t.checkedIn ? AppThemeTokens.success : null,
            size: 20,
          ),
        ),
        title: Text(t.name,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(
          t.checkedIn ? 'Checked in' : 'Not checked in',
          style: TextStyle(
            fontSize: 12,
            color: t.checkedIn
                ? AppThemeTokens.success
                : AppThemeTokens.textMuted(context),
          ),
        ),
        trailing: t.checkedIn
            ? IconButton(
                icon: const Icon(Icons.qr_code_outlined),
                tooltip: 'Show QR token',
                onPressed: _showQrToken,
              )
            : _loading
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Row(mainAxisSize: MainAxisSize.min, children: [
                    IconButton(
                      icon: const Icon(Icons.qr_code_outlined),
                      tooltip: 'Show QR token',
                      onPressed: _showQrToken,
                    ),
                    IconButton(
                      icon: const Icon(Icons.how_to_reg_outlined),
                      tooltip: 'Mark checked in',
                      onPressed: _checkIn,
                    ),
                  ]),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Share tab
// ---------------------------------------------------------------------------

class _ShareTab extends ConsumerStatefulWidget {
  const _ShareTab({required this.tournament, required this.onRefresh});

  final TournamentModel tournament;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_ShareTab> createState() => _ShareTabState();
}

class _ShareTabState extends ConsumerState<_ShareTab> {
  bool _loading = false;

  Future<void> _generateToken() async {
    setState(() => _loading = true);
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .generateShareToken(widget.tournament.id);
      widget.onRefresh();
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(extractErrorMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final token = widget.tournament.shareToken;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        UiCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(Icons.share_outlined, color: AppThemeTokens.primary500),
                const SizedBox(width: 8),
                const Text('Public Portal',
                    style: TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
              ]),
              const SizedBox(height: 8),
              Text(
                'Share a public link to your tournament. '
                'Anyone with the link can view the schedule, standings, and results — no account needed.',
                style: TextStyle(
                    fontSize: 13,
                    color: AppThemeTokens.textSecondary(context)),
              ),
              const SizedBox(height: 16),
              if (token != null && token.isNotEmpty) ...[
                Text('Share token',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppThemeTokens.textSecondary(context))),
                const SizedBox(height: 4),
                Row(children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppThemeTokens.cardElevated(context),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: AppThemeTokens.border(context)),
                      ),
                      child: SelectableText(token,
                          style: const TextStyle(
                              fontFamily: 'monospace', fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.copy_outlined),
                    tooltip: 'Copy token',
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: token));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('Token copied to clipboard')),
                      );
                    },
                  ),
                ]),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  icon: const Icon(Icons.refresh_outlined, size: 16),
                  label: _loading
                      ? const Text('Regenerating…')
                      : const Text('Regenerate Token'),
                  onPressed: _loading ? null : _generateToken,
                ),
              ] else ...[
                _loading
                    ? const Center(child: CircularProgressIndicator())
                    : FilledButton.icon(
                        icon: const Icon(Icons.link_outlined, size: 16),
                        label: const Text('Generate Share Link'),
                        onPressed: _generateToken,
                      ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Incidents tab — shows all incidents across all matches
// ---------------------------------------------------------------------------

class _IncidentsTab extends ConsumerStatefulWidget {
  const _IncidentsTab({required this.tournament});

  final TournamentModel tournament;

  @override
  ConsumerState<_IncidentsTab> createState() => _IncidentsTabState();
}

class _IncidentsTabState extends ConsumerState<_IncidentsTab> {
  List<Map<String, dynamic>> _incidents = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(tournamentRepositoryProvider);
      final allMatches = widget.tournament.matches;
      final futures = allMatches.map((m) =>
          repo.getMatchIncidents(widget.tournament.id, m.id).then(
                (list) => list
                    .map((i) => {...i, '_matchRound': m.round})
                    .toList(),
              ));
      final results = await Future.wait(futures);
      final flat = results.expand((l) => l).toList();
      flat.sort((a, b) {
        final aTime = a['createdAt'] as String? ?? '';
        final bTime = b['createdAt'] as String? ?? '';
        return bTime.compareTo(aTime); // newest first
      });
      if (mounted) setState(() {
        _incidents = flat;
        _loading = false;
      });
    } on Exception catch (e) {
      if (mounted) setState(() {
        _error = extractErrorMessage(e);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return ErrorDisplay(message: _error!);
    if (_incidents.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_outline,
                size: 48, color: AppThemeTokens.success),
            const SizedBox(height: 12),
            const Text('No incidents reported'),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadAll,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _incidents.length,
        separatorBuilder: (_, __) => const SizedBox(height: 6),
        itemBuilder: (context, i) => _IncidentTile(
          incident: _incidents[i],
          tournamentId: widget.tournament.id,
          onRefresh: _loadAll,
        ),
      ),
    );
  }
}

class _IncidentTile extends ConsumerStatefulWidget {
  const _IncidentTile({
    required this.incident,
    required this.tournamentId,
    required this.onRefresh,
  });

  final Map<String, dynamic> incident;
  final String tournamentId;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_IncidentTile> createState() => _IncidentTileState();
}

class _IncidentTileState extends ConsumerState<_IncidentTile> {
  bool _resolving = false;

  Color _statusColor(String status) {
    switch (status) {
      case 'resolved':
        return AppThemeTokens.success;
      case 'open':
        return AppThemeTokens.warning;
      default:
        return AppThemeTokens.textSecondary(context);
    }
  }

  Future<void> _resolve() async {
    final resCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Resolve Incident'),
        content: TextField(
          controller: resCtrl,
          decoration: const InputDecoration(
              labelText: 'Resolution notes (optional)'),
          maxLines: 3,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Mark Resolved')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _resolving = true);
    try {
      await ref.read(tournamentRepositoryProvider).resolveMatchIncident(
            widget.tournamentId,
            widget.incident['id'] as String,
            status: 'resolved',
            resolution: resCtrl.text.trim().isEmpty ? null : resCtrl.text.trim(),
          );
      widget.onRefresh();
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(extractErrorMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final inc = widget.incident;
    final status = inc['status'] as String? ?? 'open';
    final round = inc['_matchRound'] as String? ?? '';
    final dateStr = inc['createdAt'] as String?;
    final date = dateStr != null ? DateTime.tryParse(dateStr) : null;
    final slaDeadline = inc['slaDeadline'] != null
        ? DateTime.tryParse(inc['slaDeadline'] as String)
        : null;
    final isPastSla = slaDeadline != null &&
        slaDeadline.isBefore(DateTime.now()) &&
        status == 'open';

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: _statusColor(status).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: _statusColor(status)),
                ),
              ),
              if (isPastSla) ...[
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppThemeTokens.errorBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'PAST SLA',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: AppThemeTokens.error),
                  ),
                ),
              ],
              const Spacer(),
              if (round.isNotEmpty)
                Text(round,
                    style: TextStyle(
                        fontSize: 12,
                        color: AppThemeTokens.textSecondary(context))),
            ]),
            const SizedBox(height: 6),
            Text(
              inc['description'] as String? ?? '',
              style: const TextStyle(fontSize: 13),
            ),
            if (date != null) ...[
              const SizedBox(height: 4),
              Text(
                DateFormat('MMM d, yyyy · HH:mm').format(date.toLocal()),
                style: TextStyle(
                    fontSize: 11,
                    color: AppThemeTokens.textMuted(context)),
              ),
            ],
            if (status == 'open') ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: _resolving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : OutlinedButton.icon(
                        icon: const Icon(Icons.check_outlined, size: 14),
                        label: const Text('Resolve'),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          textStyle: const TextStyle(fontSize: 12),
                        ),
                        onPressed: _resolve,
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
// Progress row widget
// ---------------------------------------------------------------------------

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({
    required this.label,
    required this.done,
    required this.total,
    required this.color,
  });

  final String label;
  final int done;
  final int total;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (done / total * 100).round() : 0;
    return Row(children: [
      Expanded(
        child: Text('$label: $done / $total ($pct%)',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
      ),
    ]);
  }
}
