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
    setState(() { _loading = true; _error = null; });
    try {
      final invitations = await ref.read(tournamentRepositoryProvider).getMyInvitations();
      if (mounted) setState(() {
        _invitations = invitations.where((i) => (i['status'] as String?) == 'pending').toList();
        _loading = false;
      });
    } on Exception catch (e) {
      if (mounted) setState(() { _error = extractErrorMessage(e); _loading = false; });
    }
  }

  Future<void> _respond(String token, bool accept) async {
    try {
      final repo = ref.read(tournamentRepositoryProvider);
      if (accept) await repo.acceptInvitation(token); else await repo.declineInvitation(token);
      _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(accept ? 'Joined the team!' : 'Invitation declined.')));
    } on Exception catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
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
                      ? const UiEmptyState(icon: Icons.mail_outline, message: 'No pending invitations.')
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _invitations.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final inv = _invitations[i];
                            final token = inv['inviteToken'] as String? ?? '';
                            final team = inv['team'] as Map<String, dynamic>?;
                            final teamName = team?['name'] as String? ?? 'Unknown Team';
                            return Container(
                              decoration: BoxDecoration(color: AppThemeTokens.card(context), borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd), border: Border.all(color: AppThemeTokens.border(context))),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text('Invited to join: $teamName', style: const TextStyle(fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 8),
                                  Row(children: [
                                    OutlinedButton(onPressed: () => _respond(token, false), child: const Text('Decline')),
                                    const SizedBox(width: 8),
                                    FilledButton(onPressed: () => _respond(token, true), child: const Text('Accept')),
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

