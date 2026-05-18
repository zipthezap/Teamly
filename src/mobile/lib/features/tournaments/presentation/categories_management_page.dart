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


class CategoriesManagementPage extends ConsumerStatefulWidget {
  const CategoriesManagementPage({super.key, required this.tournamentId});
  final String tournamentId;

  @override
  ConsumerState<CategoriesManagementPage> createState() => _CategoriesManagementPageState();
}

class _CategoriesManagementPageState extends ConsumerState<CategoriesManagementPage> {
  List<TournamentCategoryModel> _categories = [];
  List<TournamentPoolModel> _pools = [];
  String _tournamentStatus = 'draft';
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
        ref.read(tournamentRepositoryProvider).getCategories(widget.tournamentId),
        ref.read(tournamentRepositoryProvider).getPools(widget.tournamentId),
        ref.read(tournamentRepositoryProvider).getTournament(widget.tournamentId),
      ]);
      if (mounted) {
        setState(() {
          _categories = results[0] as List<TournamentCategoryModel>;
          _pools = results[1] as List<TournamentPoolModel>;
          _tournamentStatus = (results[2] as TournamentModel).status;
          _loading = false;
        });
      }
    } on Exception catch (e) {
      if (mounted) setState(() { _error = extractErrorMessage(e); _loading = false; });
    }
  }

  Future<void> _createCategory() async {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Create Category'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Category name *'), textCapitalization: TextCapitalization.words),
          const SizedBox(height: 12),
          TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Description (optional)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final name = nameCtrl.text.trim();
    if (name.isEmpty) return;
    try {
      await ref.read(tournamentRepositoryProvider).createCategory(widget.tournamentId, {
        'name': name,
        if (descCtrl.text.trim().isNotEmpty) 'description': descCtrl.text.trim(),
      });
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _editCategory(TournamentCategoryModel cat) async {
    final nameCtrl = TextEditingController(text: cat.name);
    final descCtrl = TextEditingController(text: cat.description ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit Category'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Category name *'), textCapitalization: TextCapitalization.words),
          const SizedBox(height: 12),
          TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Description (optional)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final name = nameCtrl.text.trim();
    if (name.isEmpty) return;
    try {
      await ref.read(tournamentRepositoryProvider).updateCategory(widget.tournamentId, cat.id, {
        'name': name,
        'description': descCtrl.text.trim().isNotEmpty ? descCtrl.text.trim() : null,
      });
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _deleteCategory(TournamentCategoryModel cat) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Category'),
        content: Text('Delete "${cat.name}"? Pools in this category will become uncategorised.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error), onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(tournamentRepositoryProvider).deleteCategory(widget.tournamentId, cat.id);
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  Future<void> _assignPool(TournamentPoolModel pool) async {
    String? selected = _categories.any((c) => c.pools.any((p) => p.id == pool.id))
        ? _categories.firstWhere((c) => c.pools.any((p) => p.id == pool.id)).id
        : null;

    final result = await showDialog<String?>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('Assign "${pool.name}" to category'),
          content: DropdownButton<String?>(
            value: selected,
            isExpanded: true,
            items: [
              const DropdownMenuItem(value: null, child: Text('No category')),
              for (final cat in _categories)
                DropdownMenuItem(value: cat.id, child: Text(cat.name)),
            ],
            onChanged: (v) => setDialogState(() => selected = v),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, selected ?? ''), child: const Text('Assign')),
          ],
        ),
      ),
    );
    if (result == null || !mounted) return;
    try {
      await ref.read(tournamentRepositoryProvider).assignPoolToCategory(
        widget.tournamentId, pool.id, result.isEmpty ? null : result,
      );
      _load();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: Theme.of(context).colorScheme.error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final canManageCategories =
        !_loading && canManageTournamentAdminActions(_tournamentStatus);
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Categories')),
      floatingActionButton: FloatingActionButton(
        onPressed: canManageCategories ? _createCategory : null,
        tooltip: 'Create category',
        child: const Icon(Icons.add),
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
                      if (_categories.isEmpty)
                        const UiEmptyState(icon: Icons.category_outlined, message: 'No categories yet. Tap + to create one.'),
                      for (final cat in _categories)
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            color: AppThemeTokens.card(context),
                            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                            border: Border.all(color: AppThemeTokens.border(context)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ListTile(
                                leading: const Icon(Icons.category_outlined),
                                title: Text(cat.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                subtitle: cat.description != null ? Text(cat.description!, style: const TextStyle(fontSize: 12)) : null,
                                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                                  IconButton(icon: const Icon(Icons.edit_outlined, size: 18), tooltip: 'Edit', onPressed: canManageCategories ? () => _editCategory(cat) : null),
                                  IconButton(icon: const Icon(Icons.delete_outline, size: 18), tooltip: 'Delete', onPressed: canManageCategories ? () => _deleteCategory(cat) : null),
                                ]),
                              ),
                              if (cat.pools.isNotEmpty) ...[
                                const Divider(height: 1),
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 2),
                                  child: Text('Pools', style: TextStyle(color: AppThemeTokens.textMuted(context), fontSize: 11, fontWeight: FontWeight.w600)),
                                ),
                                for (final pool in cat.pools)
                                  ListTile(
                                    dense: true,
                                    leading: const Icon(Icons.layers_outlined, size: 16),
                                    title: Text(pool.name, style: const TextStyle(fontSize: 13)),
                                    subtitle: Text('${pool.teams.length}/${pool.maxTeams} teams'),
                                  ),
                              ],
                              const SizedBox(height: 4),
                            ],
                          ),
                        ),
                      if (_pools.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        UiSectionTitle('Assign Pools to Categories'),
                        const SizedBox(height: 8),
                        for (final pool in _pools)
                          ListTile(
                            leading: const Icon(Icons.layers_outlined),
                            title: Text(pool.name),
                            subtitle: Text(
                              _categories.any((c) => c.pools.any((p) => p.id == pool.id))
                                  ? 'Category: ${_categories.firstWhere((c) => c.pools.any((p) => p.id == pool.id)).name}'
                                  : 'No category',
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: OutlinedButton(
                              onPressed: canManageCategories ? () => _assignPool(pool) : null,
                              child: const Text('Assign'),
                            ),
                          ),
                      ],
                      const SizedBox(height: 80),
                    ],
                  ),
                ),
    );
  }
}

// ===========================================================================
// Edit Tournament Page
// ===========================================================================
