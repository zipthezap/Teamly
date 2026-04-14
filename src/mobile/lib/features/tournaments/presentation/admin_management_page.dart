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


class AdminManagementPage extends ConsumerStatefulWidget {
  const AdminManagementPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  ConsumerState<AdminManagementPage> createState() => _AdminManagementPageState();
}

class _AdminManagementPageState extends ConsumerState<AdminManagementPage> {
  List<TournamentAdminModel> _admins = [];
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
      final admins = await ref.read(tournamentRepositoryProvider).getAdmins(widget.tournamentId);
      if (mounted) setState(() { _admins = admins; _loading = false; });
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Management'),
        actions: [
          IconButton(icon: const Icon(Icons.person_add_outlined), tooltip: 'Add co-organizer', onPressed: _addAdmin),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _admins.isEmpty
                      ? const UiEmptyState(icon: Icons.supervisor_account_outlined, message: 'No co-organizers yet. Add one to delegate admin rights.')
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _admins.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (ctx, i) {
                            final admin = _admins[i];
                            return ListTile(
                              tileColor: AppThemeTokens.card(context),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd), side: BorderSide(color: AppThemeTokens.border(context))),
                              leading: const CircleAvatar(child: Icon(Icons.manage_accounts_outlined)),
                              title: Text(admin.userName),
                              subtitle: Text(admin.userEmail),
                              trailing: IconButton(icon: const Icon(Icons.remove_circle_outline, color: Colors.red), onPressed: () => _removeAdmin(admin)),
                            );
                          },
                        ),
                ),
    );
  }
}

// ===========================================================================
// Tournament Invite Page
// ===========================================================================

