import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/models/group_model.dart';
import '../data/group_repository_impl.dart';
import '../state/groups_notifier.dart';

class GroupFormPage extends ConsumerStatefulWidget {
  const GroupFormPage({super.key, this.existingGroup});

  /// Provide to enter edit mode; null = create mode.
  final GroupModel? existingGroup;

  @override
  ConsumerState<GroupFormPage> createState() => _GroupFormPageState();
}

class _GroupFormPageState extends ConsumerState<GroupFormPage> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameCtrl;
  late TextEditingController _descCtrl;
  late TextEditingController _cityCtrl;
  late TextEditingController _countryCtrl;
  late TextEditingController _maxMembersCtrl;
  late TextEditingController _tagsCtrl;

  String _sportType = '';
  String _privacy = 'public';
  bool _autoApprove = false;
  bool _allowMemberInvites = true;
  bool _saving = false;

  bool get _isEditing => widget.existingGroup != null;

  @override
  void initState() {
    super.initState();
    final g = widget.existingGroup;
    _nameCtrl = TextEditingController(text: g?.name ?? '');
    _descCtrl = TextEditingController(text: g?.description ?? '');
    _cityCtrl = TextEditingController(text: g?.city ?? '');
    _countryCtrl = TextEditingController(text: g?.country ?? '');
    _maxMembersCtrl = TextEditingController(
      text: g?.maxMembers != null ? '${g!.maxMembers}' : '',
    );
    _tagsCtrl = TextEditingController(text: g?.tags ?? '');
    _sportType = g?.sportType ?? '';
    _privacy = (g?.isPublic ?? true) ? 'public' : 'private';
    _autoApprove = g?.autoApproveJoinRequests ?? false;
    _allowMemberInvites = g?.allowMemberInvites ?? true;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _cityCtrl.dispose();
    _countryCtrl.dispose();
    _maxMembersCtrl.dispose();
    _tagsCtrl.dispose();
    super.dispose();
  }

  String _extractMsg(Exception e) {
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);

    final data = <String, dynamic>{
      'name': _nameCtrl.text.trim(),
      if (_descCtrl.text.trim().isNotEmpty)
        'description': _descCtrl.text.trim(),
      'isPublic': _privacy == 'public',
      if (_sportType.isNotEmpty) 'sportType': _sportType,
      if (_cityCtrl.text.trim().isNotEmpty) 'city': _cityCtrl.text.trim(),
      if (_countryCtrl.text.trim().isNotEmpty)
        'country': _countryCtrl.text.trim(),
      if (_maxMembersCtrl.text.trim().isNotEmpty)
        'maxMembers': int.tryParse(_maxMembersCtrl.text.trim()),
      if (_tagsCtrl.text.trim().isNotEmpty) 'tags': _tagsCtrl.text.trim(),
      'autoApproveJoinRequests': _autoApprove,
      'allowMemberInvites': _allowMemberInvites,
    };

    try {
      final repo = ref.read(groupRepositoryProvider);
      if (_isEditing) {
        await repo.updateGroup(widget.existingGroup!.id, data);
        ref.invalidate(groupDetailProvider(widget.existingGroup!.id));
      } else {
        await repo.createGroup(data);
      }
      ref.read(groupsNotifierProvider.notifier).load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _isEditing ? 'Group updated!' : 'Group created!',
            ),
          ),
        );
        context.pop();
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_extractMsg(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Edit Group' : 'Create Group'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Name
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Group name *',
                prefixIcon: Icon(Icons.group_outlined),
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.words,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Name is required' : null,
            ),
            const SizedBox(height: 16),

            // Description
            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description (optional)',
                prefixIcon: Icon(Icons.description_outlined),
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 16),

            // Sport type
            DropdownButtonFormField<String>(
              value: _sportType,
              decoration: const InputDecoration(
                labelText: 'Sport type',
                prefixIcon: Icon(Icons.sports_outlined),
                border: OutlineInputBorder(),
              ),
              items: kSportTypes
                  .map(
                    (s) => DropdownMenuItem(
                      value: s['value'],
                      child: Text(s['label']!),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _sportType = v ?? ''),
            ),
            const SizedBox(height: 16),

            // Privacy
            DropdownButtonFormField<String>(
              value: _privacy,
              decoration: const InputDecoration(
                labelText: 'Privacy',
                prefixIcon: Icon(Icons.lock_outline),
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'public', child: Text('Public')),
                DropdownMenuItem(value: 'private', child: Text('Private')),
              ],
              onChanged: (v) => setState(() => _privacy = v ?? 'public'),
            ),
            const SizedBox(height: 16),

            // City
            TextFormField(
              controller: _cityCtrl,
              decoration: const InputDecoration(
                labelText: 'City (optional)',
                prefixIcon: Icon(Icons.location_city_outlined),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),

            // Country
            TextFormField(
              controller: _countryCtrl,
              decoration: const InputDecoration(
                labelText: 'Country (optional)',
                prefixIcon: Icon(Icons.flag_outlined),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),

            // Max members
            TextFormField(
              controller: _maxMembersCtrl,
              decoration: const InputDecoration(
                labelText: 'Max members (optional)',
                prefixIcon: Icon(Icons.people_outline),
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return null;
                final n = int.tryParse(v.trim());
                if (n == null || n < 2) return 'Enter a valid number (≥ 2)';
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Tags
            TextFormField(
              controller: _tagsCtrl,
              decoration: const InputDecoration(
                labelText: 'Tags (optional, comma-separated)',
                prefixIcon: Icon(Icons.label_outline),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),

            // Auto approve
            SwitchListTile(
              title: const Text('Auto-approve join requests'),
              subtitle: const Text(
                  'New members join without needing admin approval'),
              value: _autoApprove,
              onChanged: (v) => setState(() => _autoApprove = v),
              contentPadding: EdgeInsets.zero,
            ),

            // Allow member invites
            SwitchListTile(
              title: const Text('Allow member invites'),
              subtitle: const Text('Members can invite others'),
              value: _allowMemberInvites,
              onChanged: (v) => setState(() => _allowMemberInvites = v),
              contentPadding: EdgeInsets.zero,
            ),

            const SizedBox(height: 24),

            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: _saving ? null : _submit,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(_isEditing ? 'Update Group' : 'Create Group'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
