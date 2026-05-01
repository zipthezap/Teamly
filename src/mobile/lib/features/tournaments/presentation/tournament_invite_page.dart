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


class TournamentInvitePage extends ConsumerStatefulWidget {
  const TournamentInvitePage({super.key, required this.inviteToken});

  final String inviteToken;

  @override
  ConsumerState<TournamentInvitePage> createState() => _TournamentInvitePageState();
}

class _TournamentInvitePageState extends ConsumerState<TournamentInvitePage> {
  bool _acceptLoading = false;
  bool _declineLoading = false;
  String? _result;
  String? _error;
  Map<String, dynamic>? _invitation;

  Future<void> _accept() async {
    setState(() => _acceptLoading = true);
    try {
      await ref.read(tournamentRepositoryProvider).acceptInvitation(widget.inviteToken);
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
      await ref.read(tournamentRepositoryProvider).declineInvitation(widget.inviteToken);
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
    // Attempt to load invitation details when first built
    if (_invitation == null && _error == null && _result == null) {
      ref.read(tournamentRepositoryProvider).getInvitation(widget.inviteToken).then((inv) {
        if (mounted) setState(() => _invitation = inv);
      }).catchError((e) {
        if (mounted) setState(() => _error = extractErrorMessage(e));
      });
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Team Invitation')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: _result != null
              ? Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(_result == 'accepted' ? Icons.check_circle_outline : Icons.cancel_outlined, size: 64, color: _result == 'accepted' ? Colors.green : Colors.red),
                  const SizedBox(height: 16),
                  Text(_result == 'accepted' ? 'You have joined the team!' : 'Invitation declined.', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                  const SizedBox(height: 24),
                  OutlinedButton(onPressed: () => context.go('/tournaments'), child: const Text('View Tournaments')),
                ])
              : Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.mail_outline, size: 64),
                  const SizedBox(height: 16),
                  const Text('You\'ve been invited to join a tournament team!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
                  if (_invitation != null) ...[
                    const SizedBox(height: 8),
                    Text('Team: ${_invitation!['team']?['name'] ?? ''}', style: const TextStyle(fontSize: 16)),
                    const SizedBox(height: 4),
                    Text('Tournament: ${_invitation!['team']?['tournament']?['name'] ?? ''}', style: const TextStyle(fontSize: 14, color: Colors.black54)),
                    const SizedBox(height: 4),
                    Text('Invited by: ${_invitation!['inviter']?['name'] ?? ''}', style: const TextStyle(fontSize: 14, color: Colors.black54)),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
                  ],
                  const SizedBox(height: 32),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    OutlinedButton.icon(
                      icon: _declineLoading
                          ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.close),
                      label: const Text('Decline'),
                      onPressed: _anyLoading ? null : _decline,
                    ),
                    const SizedBox(width: 16),
                    FilledButton.icon(
                      icon: _acceptLoading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Icon(Icons.check),
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

