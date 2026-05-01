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
      // Fetch players (public) and attempt invitations (may be protected).
      // Invitations request must not break the whole roster view for anonymous users.
      final players = await repo.getPlayers(widget.tournamentId, widget.teamId) as List<Map<String, dynamic>>;
      List<Map<String, dynamic>> invitations = [];
      try {
        invitations = await repo.getTeamInvitations(widget.tournamentId, widget.teamId) as List<Map<String, dynamic>>;
      } catch (_e) {
        // If invitations are protected (403) or fail, ignore and show players only.
        invitations = [];
      }

      // Detect synthetic captain entry injected by the backend (id starts with 'captain:')
      String? captainId;
      for (final p in players) {
        final pid = p['id'] as String?;
        final user = p['user'] as Map<String, dynamic>?;
        if (pid != null && pid.startsWith('captain:') && user != null) {
          captainId = user['id'] as String?;
          break;
        }
      }

      if (mounted) setState(() {
        _players = players;
        _invitations = invitations;
        _captainUserId = captainId;
        _loading = false;
      });
    } on Exception catch (e) {
      if (mounted) setState(() { _error = extractErrorMessage(e); _loading = false; });
    }
  }

  Future<void> _removePlayer(String playerId) async {
    try {
      await ref.read(tournamentRepositoryProvider).removePlayer(widget.tournamentId, widget.teamId, playerId);
      // Refresh local roster and invalidate tournament detail so other UI updates
      ref.invalidate(tournamentDetailProvider(widget.tournamentId));
      ref.invalidate(tournamentsNotifierProvider);
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
                            leading: Stack(children: [
                              const CircleAvatar(child: Icon(Icons.person_outline)),
                              // Captain badge
                              if ((p['user'] as Map?)?['id'] != null && (p['user'] as Map?)!['id'] == _captainUserId)
                                Positioned(
                                  right: -2,
                                  bottom: -2,
                                  child: Container(
                                    padding: const EdgeInsets.all(2),
                                    decoration: BoxDecoration(color: AppThemeTokens.primary500, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 1.5)),
                                    child: const Icon(Icons.star, size: 12, color: Colors.white),
                                  ),
                                ),
                            ]),
                            title: Row(children: [
                              Expanded(child: Text((p['user'] as Map?)?['name'] as String? ?? p['playerName'] as String? ?? 'Unknown')),
                              if ((p['user'] as Map?)?['id'] != null && (p['user'] as Map?)!['id'] == _captainUserId)
                                Container(
                                  margin: const EdgeInsets.only(left: 8),
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(color: Colors.blueGrey.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
                                  child: const Text('Captain', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                                ),
                            ]),
                            subtitle: Text((p['user'] as Map?)?['email'] as String? ?? ''),
                            trailing: Builder(builder: (ctx) {
                              final pid = p['id'] as String?;
                              final user = p['user'] as Map<String, dynamic>?;
                              final playerUserId = user?['id'] as String?;
                              final isPlayerCaptain = playerUserId != null && playerUserId == _captainUserId;

                              // Synthetic captain entry cannot be removed
                              if (pid != null && pid.startsWith('captain:')) {
                                return const SizedBox.shrink();
                              }

                              // If current user is captain, they can remove others but not themselves
                              if (isCaptain) {
                                if (playerUserId != null && playerUserId == currentUserId) {
                                  // Don't allow captain to remove themselves
                                  return const SizedBox.shrink();
                                }
                                return IconButton(icon: const Icon(Icons.remove_circle_outline, color: Colors.red), onPressed: () async {
                                  final confirm = await showDialog<bool>(context: context, builder: (dCtx) => AlertDialog(
                                    title: const Text('Remove Player'),
                                    content: const Text('Remove this player from the team?'),
                                    actions: [TextButton(onPressed: () => Navigator.pop(dCtx, false), child: const Text('No')), FilledButton(onPressed: () => Navigator.pop(dCtx, true), child: const Text('Yes'))],
                                  ));
                                  if (confirm == true) {
                                    _removePlayer(pid!);
                                  }
                                });
                              }

                              // If this list item represents the current user (and they're not captain), allow them to leave
                              if (playerUserId != null && playerUserId == currentUserId && !isPlayerCaptain) {
                                return TextButton.icon(onPressed: () async {
                                  final confirm = await showDialog<bool>(context: context, builder: (dCtx) => AlertDialog(
                                    title: const Text('Leave Team'),
                                    content: const Text('Are you sure you want to leave this team?'),
                                    actions: [TextButton(onPressed: () => Navigator.pop(dCtx, false), child: const Text('No')), FilledButton(onPressed: () => Navigator.pop(dCtx, true), child: const Text('Leave'))],
                                  ));
                                  if (confirm == true) {
                                    try {
                                      await ref.read(tournamentRepositoryProvider).removePlayer(widget.tournamentId, widget.teamId, pid!);
                                      // Refresh and invalidate tournament data so 'My Team' clears
                                      ref.invalidate(tournamentDetailProvider(widget.tournamentId));
                                      ref.invalidate(tournamentsNotifierProvider);
                                      if (mounted) _load();
                                    } on Exception catch (e) {
                                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
                                    }
                                  }
                                }, icon: const Icon(Icons.exit_to_app, size: 18), label: const Text('Leave'));
                              }

                              return const SizedBox.shrink();
                            }),
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
                            trailing: isCaptain
                                ? Row(mainAxisSize: MainAxisSize.min, children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(color: Colors.orange.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                                      child: const Text('pending', style: TextStyle(color: Colors.orange, fontSize: 11, fontWeight: FontWeight.w600)),
                                    ),
                                    const SizedBox(width: 8),
                                    IconButton(
                                      icon: const Icon(Icons.cancel_outlined, color: Colors.redAccent),
                                      tooltip: 'Cancel invite',
                                      onPressed: () async {
                                        final confirm = await showDialog<bool>(
                                          context: context,
                                          builder: (ctx) => AlertDialog(
                                            title: const Text('Cancel Invitation'),
                                            content: const Text('Are you sure you want to cancel this invitation?'),
                                            actions: [
                                              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
                                              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yes')),
                                            ],
                                          ),
                                        );
                                        if (confirm == true) {
                                          try {
                                            await ref.read(tournamentRepositoryProvider).cancelInvitation(widget.tournamentId, widget.teamId, inv['id'] as String);
                                            // Invalidate tournament detail and reload roster
                                            ref.invalidate(tournamentDetailProvider(widget.tournamentId));
                                            ref.invalidate(tournamentsNotifierProvider);
                                            if (mounted) _load();
                                          } on Exception catch (e) {
                                            if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
                                          }
                                        }
                                      },
                                    ),
                                  ])
                                : Container(
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

