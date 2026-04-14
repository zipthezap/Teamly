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


class TeamRosterPage extends ConsumerStatefulWidget {
  const TeamRosterPage({super.key, required this.tournamentId, required this.teamId});

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
    setState(() { _loading = true; _error = null; });
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
      final team = tournament.teams.where((t) => t.id == widget.teamId).firstOrNull;
      if (mounted) setState(() {
        _players = players;
        _invitations = invitations;
        _captainUserId = team?.captainUserId;
        _loading = false;
      });
    } on Exception catch (e) {
      if (mounted) setState(() { _error = extractErrorMessage(e); _loading = false; });
    }
  }

  Future<void> _removePlayer(String playerId) async {
    try {
      await ref.read(tournamentRepositoryProvider).removePlayer(widget.tournamentId, widget.teamId, playerId);
      _load();
    } on Exception catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
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
          TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email *', prefixIcon: Icon(Icons.email_outlined)), keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name (optional)', prefixIcon: Icon(Icons.person_outline))),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              final email = emailCtrl.text.trim();
              if (email.isEmpty) return;
              try {
                await ref.read(tournamentRepositoryProvider).sendInvitation(widget.tournamentId, widget.teamId, {'inviteeEmail': email, if (nameCtrl.text.trim().isNotEmpty) 'inviteeName': nameCtrl.text.trim()});
                if (ctx.mounted) Navigator.pop(ctx, true);
              } on Exception catch (e) {
                if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
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
            IconButton(icon: const Icon(Icons.person_add_outlined), tooltip: 'Invite player', onPressed: _showInviteDialog),
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
                        const UiEmptyState(icon: Icons.people_outline, message: 'No players yet.')
                      else
                        for (final p in _players)
                          ListTile(
                            leading: const CircleAvatar(child: Icon(Icons.person_outline)),
                            title: Text((p['user'] as Map?)?['name'] as String? ?? p['playerName'] as String? ?? 'Unknown'),
                            subtitle: Text((p['user'] as Map?)?['email'] as String? ?? ''),
                            trailing: isCaptain
                                ? IconButton(icon: const Icon(Icons.remove_circle_outline, color: Colors.red), onPressed: () => _removePlayer(p['id'] as String))
                                : null,
                          ),
                      if (_invitations.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        UiSectionTitle('Pending Invitations'),
                        const SizedBox(height: 8),
                        for (final inv in _invitations)
                          ListTile(
                            leading: const CircleAvatar(child: Icon(Icons.mail_outline)),
                            title: Text(inv['inviteeName'] as String? ?? inv['inviteeEmail'] as String? ?? ''),
                            subtitle: Text(inv['inviteeEmail'] as String? ?? ''),
                            trailing: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(color: Colors.orange.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                              child: const Text('pending', style: TextStyle(color: Colors.orange, fontSize: 11, fontWeight: FontWeight.w600)),
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

