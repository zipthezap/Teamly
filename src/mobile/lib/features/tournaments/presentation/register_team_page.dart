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


class RegisterTeamPage extends ConsumerStatefulWidget {
  const RegisterTeamPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  ConsumerState<RegisterTeamPage> createState() => _RegisterTeamPageState();
}

class _RegisterTeamPageState extends ConsumerState<RegisterTeamPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  String? _selectedPoolId;
  String? _selectedCategoryId;
  bool _loading = false;
  bool _dataLoading = true;
  List<TournamentPoolModel> _pools = [];
  List<TournamentCategoryModel> _categories = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    if (mounted) {
      setState(() {
        _dataLoading = true;
        _error = null;
      });
    }
    try {
      final results = await Future.wait([
        ref.read(tournamentRepositoryProvider).getPools(widget.tournamentId),
        ref.read(tournamentRepositoryProvider).getCategories(widget.tournamentId),
      ]);
      if (mounted) {
        final fetchedPools = results[0] as List<TournamentPoolModel>;
        final fetchedCategories = results[1] as List<TournamentCategoryModel>;
        final defaultCategoryId = fetchedCategories.isNotEmpty
            ? (_selectedCategoryId ?? fetchedCategories.first.id)
            : null;
        setState(() {
          _pools = fetchedPools;
          _categories = fetchedCategories;
          _selectedCategoryId = defaultCategoryId;
          if (_selectedPoolId != null && _selectedCategoryId != null) {
            TournamentPoolModel? selectedPool;
            for (final pool in _pools) {
              if (pool.id == _selectedPoolId) {
                selectedPool = pool;
                break;
              }
            }
            if (selectedPool == null || selectedPool.categoryId != _selectedCategoryId) {
              _selectedPoolId = null;
            }
          }
          _dataLoading = false;
        });
      }
    } on Exception catch (e) {
      if (mounted) setState(() { _error = extractErrorMessage(e); _dataLoading = false; });
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_categories.isNotEmpty && _selectedCategoryId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a category.')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      final result = await ref.read(tournamentRepositoryProvider).selfRegisterTeam(
        widget.tournamentId,
        _nameCtrl.text.trim(),
        poolId: _selectedPoolId,
        categoryId: _selectedCategoryId,
      );
      if (!mounted) return;
      final onWaitlist = result['onWaitlist'] == true;
      if (onWaitlist) {
        final pool = result['pool'] as Map<String, dynamic>?;
        final poolName = pool?['name'] as String? ?? 'the pool';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Pool "$poolName" is full — your team is on the waitlist!'),
          backgroundColor: Colors.orange,
        ));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Team registered successfully!')));
      }
      context.pop(true);
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: Theme.of(context).colorScheme.error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Register Team')),
      body: _dataLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _loadData)
              : Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      TextFormField(
                        controller: _nameCtrl,
                        decoration: const InputDecoration(labelText: 'Team name *', prefixIcon: Icon(Icons.shield_outlined)),
                        textCapitalization: TextCapitalization.words,
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                      if (_categories.isEmpty) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppThemeTokens.warning.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                            border: Border.all(
                              color: AppThemeTokens.warning.withValues(alpha: 0.35),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(
                                Icons.info_outline,
                                size: 18,
                                color: AppThemeTokens.warning,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Categories are required before teams can register. Ask the organizer to create a category first.',
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                        color: AppThemeTokens.warning,
                                      ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      if (_categories.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        DropdownButtonFormField<String?>(
                          value: _categories.isNotEmpty
                              ? (_selectedCategoryId ?? _categories.first.id)
                              : _selectedCategoryId,
                          decoration: InputDecoration(
                            labelText: _categories.isNotEmpty ? 'Category *' : 'Category',
                            prefixIcon: const Icon(Icons.category_outlined),
                            helperText: 'Choose a category first',
                          ),
                          dropdownColor: AppThemeTokens.cardElevated(context),
                          items: [
                            for (final cat in _categories)
                              DropdownMenuItem(value: cat.id, child: Text(cat.name)),
                          ],
                          onChanged: (v) {
                            if (v == null) return;
                            setState(() {
                              _selectedCategoryId = v;
                              // If a pool is selected but no longer belongs to the chosen
                              // category, clear the pool selection.
                              if (_selectedPoolId != null) {
                                final selectedPool = _pools.firstWhere((p) => p.id == _selectedPoolId, orElse: () => null as dynamic);
                                if (selectedPool == null || selectedPool.categoryId != _selectedCategoryId) {
                                  _selectedPoolId = null;
                                }
                              }
                            });
                          },
                        ),
                      ],
                      if (_pools.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        DropdownButtonFormField<String?>(
                          value: _selectedPoolId,
                          decoration: InputDecoration(
                            labelText: 'Pool (optional)',
                            prefixIcon: const Icon(Icons.layers_outlined),
                            helperText: _selectedCategoryId != null ? 'Showing pools for selected category' : null,
                          ),
                          dropdownColor: AppThemeTokens.cardElevated(context),
                          items: [
                            const DropdownMenuItem(value: null, child: Text('No pool')),
                            for (final pool in (_selectedCategoryId == null ? _pools : _pools.where((p) => p.categoryId == _selectedCategoryId)))
                              DropdownMenuItem(value: pool.id, child: Text('${pool.name} (${pool.teams.length}/${pool.maxTeams}${pool.isFull ? " – FULL" : ""})'))
                          ],
                          onChanged: (v) => setState(() => _selectedPoolId = v),
                        ),
                      ],
                      const SizedBox(height: 24),
                      UiPrimaryButton(
                        text: 'Register Team',
                        icon: Icons.check_circle_outline,
                        onPressed: _loading || _categories.isEmpty ? null : _submit,
                        loading: _loading,
                      ),
                    ],
                  ),
                ),
    );
  }
}

// ===========================================================================
// Team Roster Page
// ===========================================================================
