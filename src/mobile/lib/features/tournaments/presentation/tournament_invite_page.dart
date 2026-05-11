import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/tournament_repository_impl.dart';

class TournamentInvitePage extends ConsumerStatefulWidget {
  const TournamentInvitePage({super.key, required this.inviteToken});

  final String inviteToken;

  @override
  ConsumerState<TournamentInvitePage> createState() => _TournamentInvitePageState();
}

class _TournamentInvitePageState extends ConsumerState<TournamentInvitePage> {
  bool _acceptLoading = false;
  bool _declineLoading = false;
  bool _detailsLoading = true;
  String? _result;
  // Non-null when the invitation was already actioned before this session.
  String? _preexistingStatus;
  String? _error;
  Map<String, dynamic>? _details;
  Map<String, dynamic>? _invitation;

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    setState(() { _detailsLoading = true; _error = null; });
    try {
      final details = await ref.read(tournamentRepositoryProvider).getInvitationDetails(widget.inviteToken);
      if (mounted) {
        final status = details['status'] as String?;
        String? preexisting;
        String? result;
        if (status != null && status != 'pending') {
          preexisting = status;
          result = (status == 'accepted') ? 'accepted' : 'declined';
        }
        setState(() {
          _details = details;
          _preexistingStatus = preexisting;
          _result = result;
          _detailsLoading = false;
        });
      }
    } on Exception catch (e) {
      if (mounted) setState(() { _error = extractErrorMessage(e); _detailsLoading = false; });
    }
  }

  /// Check auth; if unauthenticated, navigate to login with return URL.
  bool _requireAuth() {
    final authState = ref.read(authNotifierProvider);
    if (!authState.isAuthenticated) {
      context.go('/login?returnUrl=/tournaments/invite/${widget.inviteToken}');
      return false;
    }
    return true;
  }

  Future<void> _accept() async {
    if (!_requireAuth()) return;
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
    if (!_requireAuth()) return;
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
          child: _detailsLoading
              ? const CircularProgressIndicator()
              : _result != null
                  ? Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(
                        _result == 'accepted'
                            ? Icons.check_circle_outline
                            : (_preexistingStatus == 'cancelled' ? Icons.info_outline : Icons.cancel_outlined),
                        size: 64,
                        color: _result == 'accepted'
                            ? Colors.green
                            : (_preexistingStatus == 'cancelled' ? Colors.orange : Colors.red),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _result == 'accepted'
                            ? (_preexistingStatus != null
                                ? 'You have already accepted this invitation.'
                                : 'You have joined the team!')
                            : (_preexistingStatus == 'cancelled'
                                ? 'This invitation is no longer available.'
                                : (_preexistingStatus != null
                                    ? 'You have already declined this invitation.'
                                    : 'Invitation declined.')),
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      OutlinedButton(
                        onPressed: () => context.go('/tournaments'),
                        child: const Text('View Tournaments'),
                      ),
                    ])
                  : Column(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.mail_outline, size: 64),
                      const SizedBox(height: 16),
                      const Text(
                        'You\'ve been invited to join a tournament team!',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                        textAlign: TextAlign.center,
                      ),
                      if (_details != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppThemeTokens.card(context),
                            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                            border: Border.all(color: AppThemeTokens.border(context)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (_details!['team'] != null)
                                _DetailRow(icon: Icons.shield_outlined, label: 'Team', value: _details!['team']['name'] as String? ?? ''),
                              if (_details!['tournament'] != null) ...[
                                const SizedBox(height: 8),
                                _DetailRow(icon: Icons.emoji_events_outlined, label: 'Tournament', value: _details!['tournament']['name'] as String? ?? ''),
                              ],
                              if (_details!['inviter'] != null) ...[
                                const SizedBox(height: 8),
                                _DetailRow(icon: Icons.person_outline, label: 'Invited by', value: _details!['inviter']['name'] as String? ?? ''),
                              ],
                              if (_details!['message'] != null && (_details!['message'] as String).isNotEmpty) ...[
                                const SizedBox(height: 8),
                                _DetailRow(icon: Icons.message_outlined, label: 'Message', value: _details!['message'] as String),
                              ],
                            ],
                          ),
                        ),
                      ] else if (_invitation != null) ...[
                        const SizedBox(height: 8),
                        Text('Team: ${_invitation!['team']?['name'] ?? ''}', style: const TextStyle(fontSize: 16)),
                        const SizedBox(height: 4),
                        Text('Tournament: ${_invitation!['team']?['tournament']?['name'] ?? ''}', style: const TextStyle(fontSize: 14, color: Colors.black54)),
                        const SizedBox(height: 4),
                        Text('Invited by: ${_invitation!['inviter']?['name'] ?? ''}', style: const TextStyle(fontSize: 14, color: Colors.black54)),
                      ] else if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
                      ],
                      const SizedBox(height: 32),
                      if (_error == null || _details != null || _invitation != null) ...[
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
                            icon: _acceptLoading
                                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                : const Icon(Icons.check),
                            label: const Text('Accept'),
                            onPressed: _anyLoading ? null : _accept,
                          ),
                        ]),
                      ],
                    ]),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppThemeTokens.textMuted(context)),
        const SizedBox(width: 8),
        Text('$label: ', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppThemeTokens.textSecondary(context))),
        Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
      ],
    );
  }
}

// ===========================================================================
// My Invitations Page
// ===========================================================================

