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
import 'tournament_ui_rules.dart';


class AdminManagementPage extends ConsumerStatefulWidget {
  const AdminManagementPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  ConsumerState<AdminManagementPage> createState() => _AdminManagementPageState();
}

class _AdminManagementPageState extends ConsumerState<AdminManagementPage> {
  List<TournamentAdminModel> _admins = [];
  String _tournamentStatus = 'draft';
  String? _organizerName;
  String? _organizerEmail;
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
        ref.read(tournamentRepositoryProvider).getAdmins(widget.tournamentId),
        ref.read(tournamentRepositoryProvider).getTournament(widget.tournamentId),
      ]);
      if (mounted) {
        final tournament = results[1] as TournamentModel;
        final admins = results[0] as List<TournamentAdminModel>;
        setState(() {
          // Organizer is an implicit owner role and cannot be removed through
          // co-organizer management, so never show them as a removable admin.
          _admins = admins
              .where((admin) => admin.userId != tournament.creatorId)
              .toList();
          _tournamentStatus = tournament.status;
          _organizerName = tournament.organizerName;
          _organizerEmail = tournament.organizerEmail;
          _loading = false;
        });
      }
    } on Exception catch (e) {
      if (mounted) setState(() { _error = extractErrorMessage(e); _loading = false; });
    }
  }

  Future<void> _addAdmin() async {
    final emailCtrl = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Co-organizer'),
        content: TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'User email', prefixIcon: Icon(Icons.email_outlined)), keyboardType: TextInputType.emailAddress),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              final email = emailCtrl.text.trim();
              if (email.isEmpty) return;
              try {
                await ref.read(tournamentRepositoryProvider).addAdmin(widget.tournamentId, {'email': email});
                if (ctx.mounted) Navigator.pop(ctx, true);
              } on Exception catch (e) {
                if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
    if (result == true) _load();
  }

  Future<void> _removeAdmin(TournamentAdminModel admin) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Co-organizer'),
        content: Text('Remove ${admin.userName} as co-organizer?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton.tonal(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(tournamentRepositoryProvider).removeAdmin(widget.tournamentId, admin.userId);
      _load();
    } on Exception catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final canManageAdmins =
        !_loading && canManageTournamentAdminActions(_tournamentStatus);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Management'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_outlined),
            tooltip: 'Add co-organizer',
            onPressed: canManageAdmins ? _addAdmin : null,
          ),
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
                      ListTile(
                        tileColor: AppThemeTokens.card(context),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppThemeTokens.radiusMd),
                          side: BorderSide(color: AppThemeTokens.border(context)),
                        ),
                        leading: const CircleAvatar(
                          child: Icon(Icons.workspace_premium_outlined),
                        ),
                        title: Text(_organizerName ?? 'Tournament Organizer'),
                        subtitle: Text(_organizerEmail ?? 'Owner role'),
                        trailing: const UiStatusBadge(
                          label: 'Organizer',
                          status: UiStatusType.info,
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (_admins.isEmpty)
                        const UiEmptyState(
                          icon: Icons.supervisor_account_outlined,
                          message:
                              'No co-organizers yet. Add one to delegate admin rights.',
                        )
                      else
                        ..._admins.map((admin) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              tileColor: AppThemeTokens.card(context),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(
                                  AppThemeTokens.radiusMd,
                                ),
                                side: BorderSide(
                                  color: AppThemeTokens.border(context),
                                ),
                              ),
                              leading: const CircleAvatar(
                                child: Icon(Icons.manage_accounts_outlined),
                              ),
                              title: Text(admin.userName),
                              subtitle: Text(admin.userEmail),
                              trailing: IconButton(
                                icon: const Icon(
                                  Icons.remove_circle_outline,
                                  color: Colors.red,
                                ),
                                onPressed: canManageAdmins
                                    ? () => _removeAdmin(admin)
                                    : null,
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }
}

// ===========================================================================
// Tournament Invite Page
// ===========================================================================
