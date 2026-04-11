import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/league_repository_impl.dart';
import '../domain/league_repository.dart';
import '../state/leagues_notifier.dart';

class CreateLeaguePage extends ConsumerStatefulWidget {
  const CreateLeaguePage({super.key});

  @override
  ConsumerState<CreateLeaguePage> createState() => _CreateLeaguePageState();
}

class _CreateLeaguePageState extends ConsumerState<CreateLeaguePage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _sportController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _locationController = TextEditingController();
  bool _isPublic = true;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _nameController.dispose();
    _sportController.dispose();
    _descriptionController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);
    try {
      final repo = ref.read(leagueRepositoryProvider);
      await repo.createLeague(
        name: _nameController.text.trim(),
        sport: _sportController.text.trim(),
        isPublic: _isPublic,
        description: _descriptionController.text.trim().isEmpty
            ? null
            : _descriptionController.text.trim(),
        location: _locationController.text.trim().isEmpty
            ? null
            : _locationController.text.trim(),
      );
      await ref.read(leaguesNotifierProvider.notifier).refresh();
      if (mounted) context.go('/leagues');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create league: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create League')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'League Name *'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Name is required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _sportController,
              decoration: const InputDecoration(labelText: 'Sport *'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Sport is required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: 'Description'),
              maxLines: 3,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _locationController,
              decoration: const InputDecoration(labelText: 'Location'),
            ),
            const SizedBox(height: 12),
            SwitchListTile(
              title: const Text('Public League'),
              value: _isPublic,
              onChanged: (v) => setState(() => _isPublic = v),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Create League'),
            ),
          ],
        ),
      ),
    );
  }
}
