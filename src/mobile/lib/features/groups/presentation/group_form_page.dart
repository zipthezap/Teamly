import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/error_utils.dart';
import '../../../core/models/group_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/ui_primitives.dart';
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
  bool _allowMemberCopyLink = true;
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
    _allowMemberCopyLink = g?.allowMemberCopyLink ?? true;
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
      'allowMemberCopyLink': _allowMemberCopyLink,
    };

    try {
      final repo = ref.read(groupRepositoryProvider);
      if (_isEditing) {
        await repo.updateGroup(widget.existingGroup!.id, data);
        ref.invalidate(groupDetailProvider(widget.existingGroup!.id));
      } else {
        await repo.createGroup(data);
      }
      ref.read(groupsNotifierProvider.notifier).reload();
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
            content: Text(extractErrorMessage(e)),
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
                
              ),
            ),
            const SizedBox(height: 16),

            // Country
            TextFormField(
              controller: _countryCtrl,
              decoration: const InputDecoration(
                labelText: 'Country (optional)',
                prefixIcon: Icon(Icons.flag_outlined),
                
              ),
            ),
            const SizedBox(height: 16),

            // Max members
            TextFormField(
              controller: _maxMembersCtrl,
              decoration: const InputDecoration(
                labelText: 'Max members (optional)',
                prefixIcon: Icon(Icons.people_outline),
                
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
                
              ),
            ),
            const SizedBox(height: 16),

            // Auto approve
            _SwitchRow(
              title: 'Auto-approve join requests',
              subtitle: 'New members join without needing admin approval',
              value: _autoApprove,
              icon: Icons.how_to_reg_rounded,
              color: AppThemeTokens.success,
              onChanged: (v) => setState(() => _autoApprove = v),
            ),

            const SizedBox(height: 10),

            // Allow member invites
            _SwitchRow(
              title: 'Allow member invites',
              subtitle: 'Members can invite others',
              value: _allowMemberInvites,
              icon: Icons.person_add_rounded,
              color: AppThemeTokens.info,
              onChanged: (v) => setState(() => _allowMemberInvites = v),
            ),

            const SizedBox(height: 10),

            // Allow members to copy invite link
            _SwitchRow(
              title: 'Allow copy invite link',
              subtitle: 'Members can copy the invite link',
              value: _allowMemberCopyLink,
              icon: Icons.link_rounded,
              color: AppThemeTokens.info,
              onChanged: (v) => setState(() => _allowMemberCopyLink = v),
            ),

            const SizedBox(height: 24),

            UiPrimaryButton(
              text: _isEditing ? 'Update Group' : 'Create Group',
              onPressed: _saving ? null : _submit,
              loading: _saving,
            ),
          ],
        ),
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.icon,
    required this.color,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final IconData icon;
  final Color color;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppThemeTokens.card(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: AppThemeTokens.text(context))),
                Text(subtitle,
                    style: TextStyle(
                        fontSize: 12,
                        color: AppThemeTokens.textSecondary(context))),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}
