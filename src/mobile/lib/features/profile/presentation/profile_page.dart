import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/models/user_model.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_mode_controller.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../data/email_preferences_repository_impl.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _cityCtrl;
  late TextEditingController _countryCtrl;

  bool _editing = false;
  bool _saving = false;
  bool _uploadingPicture = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authNotifierProvider).user;
    _nameCtrl = TextEditingController(text: user?.name ?? '');
    _emailCtrl = TextEditingController(text: user?.email ?? '');
    _cityCtrl = TextEditingController(text: user?.city ?? '');
    _countryCtrl = TextEditingController(text: user?.country ?? '');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _cityCtrl.dispose();
    _countryCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadProfilePicture() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 800,
      maxHeight: 800,
      imageQuality: 85,
    );
    if (file == null || !mounted) return;

    setState(() => _uploadingPicture = true);
    try {
      final dio = ref.read(dioProvider);
      final MultipartFile multipartFile;
      if (kIsWeb) {
        final bytes = await file.readAsBytes();
        multipartFile = MultipartFile.fromBytes(
          bytes,
          filename: 'profile.jpg',
        );
      } else {
        multipartFile = await MultipartFile.fromFile(
          file.path,
          filename: 'profile.jpg',
        );
      }
      final formData = FormData.fromMap({'profilePicture': multipartFile});
      final response = await dio.put<Map<String, dynamic>>(
        '/auth/profile',
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );
      final updatedUser = UserModel.fromJson(
        (response.data?['user'] ?? response.data!) as Map<String, dynamic>,
      );
      ref.read(authNotifierProvider.notifier).updateUser(updatedUser);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile picture updated')),
        );
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
      if (mounted) setState(() => _uploadingPicture = false);
    }
  }

  Future<void> _saveProfile() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      final dio = ref.read(dioProvider);
      final response = await dio.put<Map<String, dynamic>>(
        '/auth/profile',
        data: {
          'name': _nameCtrl.text.trim(),
          'email': _emailCtrl.text.trim(),
          if (_cityCtrl.text.trim().isNotEmpty) 'city': _cityCtrl.text.trim(),
          if (_countryCtrl.text.trim().isNotEmpty)
            'country': _countryCtrl.text.trim(),
        },
      );

      final updatedUser = UserModel.fromJson(
        (response.data?['user'] ?? response.data!) as Map<String, dynamic>,
      );
      ref.read(authNotifierProvider.notifier).updateUser(updatedUser);
      if (!mounted) return;
      setState(() => _editing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated')),
        );
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

  Future<void> _changePassword() async {
    final currentPwCtrl = TextEditingController();
    final newPwCtrl = TextEditingController();
    final confirmPwCtrl = TextEditingController();
    final dialogFormKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Change Password'),
        content: Form(
          key: dialogFormKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: currentPwCtrl,
                decoration: const InputDecoration(labelText: 'Current password'),
                obscureText: true,
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: newPwCtrl,
                decoration: const InputDecoration(labelText: 'New password'),
                obscureText: true,
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Required';
                  if (v.length < 8) return 'At least 8 characters';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: confirmPwCtrl,
                decoration:
                    const InputDecoration(labelText: 'Confirm new password'),
                obscureText: true,
                validator: (v) =>
                    v != newPwCtrl.text ? 'Passwords do not match' : null,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (dialogFormKey.currentState?.validate() ?? false) {
                Navigator.of(ctx).pop(true);
              }
            },
            child: const Text('Update'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      final dio = ref.read(dioProvider);
      await dio.put<void>(
        '/auth/password',
        data: {
          'currentPassword': currentPwCtrl.text,
          'newPassword': newPwCtrl.text,
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password changed successfully')),
        );
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
      currentPwCtrl.dispose();
      newPwCtrl.dispose();
      confirmPwCtrl.dispose();
    }
  }

  String _themeModeLabel(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.light:
        return 'Light mode';
      case ThemeMode.dark:
        return 'Dark mode';
      case ThemeMode.system:
        return 'System default';
    }
  }

  Future<void> _openThemePicker(ThemeMode selectedMode) async {
    final picked = await showModalBottomSheet<ThemeMode>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ListTile(
                title: Text(
                  'Appearance',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              RadioListTile<ThemeMode>(
                value: ThemeMode.light,
                groupValue: selectedMode,
                onChanged: (value) => Navigator.of(context).pop(value),
                title: const Text('Light'),
              ),
              RadioListTile<ThemeMode>(
                value: ThemeMode.dark,
                groupValue: selectedMode,
                onChanged: (value) => Navigator.of(context).pop(value),
                title: const Text('Dark'),
              ),
              RadioListTile<ThemeMode>(
                value: ThemeMode.system,
                groupValue: selectedMode,
                onChanged: (value) => Navigator.of(context).pop(value),
                title: const Text('System default'),
              ),
            ],
          ),
        );
      },
    );

    if (picked != null) {
      ref.read(themeModeProvider.notifier).setThemeMode(picked);
    }
  }

  // ─── Build ──────────────────────────────────────────────────────────────────

  /// Shows a two-step confirmation dialog before permanently deleting the
  /// account.  The user must type "DELETE" to proceed, matching the App Store
  /// and Google Play requirement to make deletion intentional and irreversible.
  Future<void> _deleteAccount() async {
    // Step 1: explain what will be deleted and ask for confirmation.
    final step1Confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
          'This will permanently delete your account and all personal data '
          'associated with it, including your profile, profile pictures, and '
          'active sessions.\n\n'
          'Group messages and session records you created will be preserved '
          'for other users but will no longer be linked to an active account.\n\n'
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );

    if (step1Confirmed != true || !mounted) return;

    // Step 2: type "DELETE" to confirm — prevents accidental deletion.
    final confirmCtrl = TextEditingController();
    bool? step2Confirmed;
    try {
      step2Confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => StatefulBuilder(
          builder: (ctx, setDialogState) => AlertDialog(
            title: const Text('Confirm deletion'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Type DELETE in the box below to permanently delete your account.',
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: confirmCtrl,
                  autofocus: true,
                  decoration: const InputDecoration(
                    hintText: 'DELETE',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (_) => setDialogState(() {}),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(
                    backgroundColor: confirmCtrl.text == 'DELETE'
                        ? Theme.of(ctx).colorScheme.error
                        : null),
                onPressed: confirmCtrl.text == 'DELETE'
                    ? () => Navigator.of(ctx).pop(true)
                    : null,
                child: const Text('Delete my account'),
              ),
            ],
          ),
        ),
      );
    } finally {
      confirmCtrl.dispose();
    }

    if (step2Confirmed != true || !mounted) return;

    await _performDeleteAccount();
  }

  Future<void> _performDeleteAccount() async {
    try {
      await ref.read(authNotifierProvider.notifier).deleteAccount();
      if (mounted) context.go('/auth');
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(extractErrorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState.user;
    final themeMode = ref.watch(themeModeProvider);

    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: _buildAppBar(),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          _buildHero(user),
          // Animated edit form
          AnimatedSize(
            duration: const Duration(milliseconds: 320),
            curve: Curves.easeOutCubic,
            child: _editing ? _buildEditForm() : const SizedBox.shrink(),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SectionHeader('Security'),
                const SizedBox(height: 8),
                _SettingsCard(tiles: [
                  _TileData(
                    icon: Icons.lock_outline_rounded,
                    color: const Color(0xFF2196F3),
                    label: 'Change password',
                    onTap: _changePassword,
                  ),
                  _TileData(
                    icon: Icons.security_rounded,
                    color: const Color(0xFF7C4DFF),
                    label: 'Two-factor authentication',
                    onTap: () => context.push('/profile/two-factor'),
                  ),
                  _TileData(
                    icon: Icons.devices_rounded,
                    color: const Color(0xFF00BCD4),
                    label: 'Active sessions',
                    onTap: () => context.push('/profile/sessions'),
                  ),
                ]),
                const SizedBox(height: 24),
                _SectionHeader('Preferences'),
                const SizedBox(height: 8),
                _SettingsCard(tiles: [
                  _TileData(
                    icon: Icons.palette_outlined,
                    color: const Color(0xFF2196F3),
                    label: 'Appearance · ${_themeModeLabel(themeMode)}',
                    onTap: () => _openThemePicker(themeMode),
                  ),
                  _TileData(
                    icon: Icons.notifications_outlined,
                    color: const Color(0xFFFF9800),
                    label: 'Notification preferences',
                    onTap: () =>
                        context.push('/profile/notification-preferences'),
                  ),
                  _TileData(
                    icon: Icons.email_outlined,
                    color: const Color(0xFF00BCD4),
                    label: 'Email preferences',
                    onTap: () => context.push('/profile/email-preferences'),
                  ),
                  _TileData(
                    icon: Icons.alarm_rounded,
                    color: const Color(0xFF4CAF50),
                    label: 'My reminders',
                    onTap: () => context.push('/profile/reminders'),
                  ),
                ]),
                const SizedBox(height: 24),
                _SectionHeader('Account'),
                const SizedBox(height: 8),
                _SettingsCard(tiles: [
                  _TileData(
                    icon: Icons.photo_library_outlined,
                    color: const Color(0xFF00BCD4),
                    label: 'Profile picture history',
                    onTap: () => context.push('/profile/pictures'),
                  ),
                  _TileData(
                    icon: Icons.link_rounded,
                    color: const Color(0xFF7C4DFF),
                    label: 'Connected accounts',
                    onTap: () => context.push('/profile/connected-accounts'),
                  ),
                  _TileData(
                    icon: Icons.delete_forever_rounded,
                    color: AppThemeTokens.error,
                    label: 'Delete account',
                    onTap: _deleteAccount,
                  ),
                ]),
                const SizedBox(height: 32),
                // Sign out
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      await ref
                          .read(authNotifierProvider.notifier)
                          .logout();
                      if (context.mounted) context.go('/auth');
                    },
                    icon: const Icon(Icons.logout_rounded,
                        color: AppThemeTokens.error, size: 18),
                    label: const Text(
                      'Sign out',
                      style: TextStyle(
                        color: AppThemeTokens.error,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppThemeTokens.error,
                      side: BorderSide(
                          color: AppThemeTokens.error.withValues(alpha: 0.45)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(AppThemeTokens.radiusMd),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      foregroundColor: AppThemeTokens.text(context),
      title: _editing
          ? Text(
              'Edit Profile',
              style: TextStyle(
                color: AppThemeTokens.text(context),
                fontSize: 17,
                fontWeight: FontWeight.w600,
              ),
            )
          : null,
      actions: [
        if (!_editing)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: _AppBarIconButton(
              icon: Icons.edit_outlined,
              onTap: () => setState(() => _editing = true),
            ),
          )
        else ...[
          TextButton(
            onPressed: () => setState(() => _editing = false),
            child: Text(
              'Cancel',
              style: TextStyle(color: AppThemeTokens.textSecondary(context)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton(
              onPressed: _saving ? null : _saveProfile,
              child: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppThemeTokens.primary400),
                    )
                  : const Text(
                      'Save',
                      style: TextStyle(
                          color: AppThemeTokens.primary400,
                          fontWeight: FontWeight.w700),
                    ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildHero(UserModel user) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final topPadding = MediaQuery.of(context).padding.top;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: AppThemeTokens.heroGrad(context),
      ),
      child: Column(
        children: [
          SizedBox(height: topPadding + 64),
          // Avatar with gradient border ring + camera button
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: const BoxDecoration(
                  gradient: AppThemeTokens.primaryGradient,
                  shape: BoxShape.circle,
                ),
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0D1B2E) : Colors.white,
                    shape: BoxShape.circle,
                  ),
                  child: UserAvatar(
                    name: user.name,
                    imageUrl: user.profilePicture,
                    radius: 48,
                  ),
                ),
              ),
              Positioned(
                bottom: 2,
                right: 2,
                child: GestureDetector(
                  onTap: _uploadingPicture
                      ? null
                      : _pickAndUploadProfilePicture,
                  child: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      gradient: _uploadingPicture
                          ? null
                          : AppThemeTokens.primaryGradient,
                      color: _uploadingPicture
                          ? (isDark ? AppThemeTokens.darkCardElevated : AppThemeTokens.lightCardElevated)
                          : null,
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: isDark ? const Color(0xFF0D1B2E) : Colors.white, width: 2.5),
                    ),
                    child: _uploadingPicture
                        ? const Padding(
                            padding: EdgeInsets.all(8),
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.camera_alt_rounded,
                            size: 16, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          // Name
          Text(
            user.name,
            style: TextStyle(
              color: AppThemeTokens.text(context),
              fontSize: 24,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 4),
          // Email
          Text(
            user.email,
            style: TextStyle(
              color: AppThemeTokens.textSecondary(context),
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 12),
          // Verified / unverified badge
          if (user.emailVerified)
            UiStatusBadge(
              label: 'Verified',
              status: UiStatusType.success,
              dot: true,
            )
          else ...[
            UiStatusBadge(
              label: 'Email not verified',
              status: UiStatusType.warning,
              dot: true,
            ),
            const SizedBox(height: 8),
            const _SendVerificationButton(),
          ],
          // Location row
          if ((user.city != null && user.city!.isNotEmpty) ||
              (user.country != null && user.country!.isNotEmpty)) ...[
            const SizedBox(height: 10),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.place_rounded,
                    size: 14, color: AppThemeTokens.textMuted(context)),
                const SizedBox(width: 4),
                Text(
                  [user.city, user.country]
                      .whereType<String>()
                      .where((s) => s.isNotEmpty)
                      .join(', '),
                  style: TextStyle(
                    color: AppThemeTokens.textMuted(context),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ],
          // Stat pills — only in view mode
          if (!_editing) ...[
            const SizedBox(height: 22),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                _StatPill(label: 'Upcoming', value: '0'),
                SizedBox(width: 12),
                _StatPill(label: 'Groups', value: '0'),
              ],
            ),
          ],
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildEditForm() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sectionTitleColor = isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText;
    final cancelBorderColor = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final cancelFgColor = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: UiCard(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Personal info',
                style: TextStyle(
                  color: sectionTitleColor,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 18),
              TextFormField(
                controller: _nameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Full name',
                  prefixIcon: Icon(Icons.person_outline_rounded),
                ),
                textCapitalization: TextCapitalization.words,
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Name is required' : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _emailCtrl,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  prefixIcon: Icon(Icons.email_outlined),
                ),
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Email is required';
                  final r = RegExp(r'^[^@]+@[^@]+\.[^@]+');
                  if (!r.hasMatch(v.trim())) return 'Enter a valid email';
                  return null;
                },
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _cityCtrl,
                decoration: const InputDecoration(
                  labelText: 'City (optional)',
                  prefixIcon: Icon(Icons.location_city_outlined),
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _countryCtrl,
                decoration: const InputDecoration(
                  labelText: 'Country (optional)',
                  prefixIcon: Icon(Icons.flag_outlined),
                ),
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => setState(() => _editing = false),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        side: BorderSide(color: cancelBorderColor),
                        foregroundColor: cancelFgColor,
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppThemeTokens.radiusMd),
                        ),
                      ),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: UiPrimaryButton(
                      text: 'Save',
                      loading: _saving,
                      onPressed: _saving ? null : _saveProfile,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Supporting widgets ──────────────────────────────────────────────────────

class _AppBarIconButton extends StatelessWidget {
  const _AppBarIconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // The profile AppBar is transparent and always floats over the dark hero,
    // so the icon container uses dark-mode colors to remain visible.
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: (isDark ? AppThemeTokens.darkCard : const Color(0xFF1C2535))
              .withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
          border: Border.all(
              color: isDark ? AppThemeTokens.darkBorder : const Color(0xFF2A3548)),
        ),
        child: Icon(icon, size: 18, color: AppThemeTokens.darkText),
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
    final borderColor = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final valueColor = isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText;
    final labelColor = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: BoxDecoration(
        color: cardColor.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontSize: 22,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: labelColor,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(left: 2, bottom: 2),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          color: isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}

class _TileData {
  const _TileData({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.tiles});
  final List<_TileData> tiles;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
    final borderColor = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final dividerColor = isDark
        ? AppThemeTokens.darkBorder.withValues(alpha: 0.6)
        : AppThemeTokens.lightBorder;

    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        children: [
          for (int i = 0; i < tiles.length; i++) ...[
            _SettingsTile(data: tiles[i]),
            if (i < tiles.length - 1)
              Divider(
                height: 1,
                indent: 60,
                endIndent: 0,
                color: dividerColor,
              ),
          ],
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({required this.data});
  final _TileData data;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText;
    final arrowColor = isDark ? AppThemeTokens.darkTextMuted : AppThemeTokens.lightTextMuted;

    return ListTile(
      onTap: data.onTap,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: data.color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
        ),
        child: Icon(data.icon, size: 18, color: data.color),
      ),
      title: Text(
        data.label,
        style: TextStyle(
          color: titleColor,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
      trailing: Icon(
        Icons.arrow_forward_ios_rounded,
        size: 14,
        color: arrowColor,
      ),
    );
  }
}

/// Small button shown below the "Email not verified" badge that lets users
/// trigger a verification email directly from their profile hero.
class _SendVerificationButton extends ConsumerStatefulWidget {
  const _SendVerificationButton();

  @override
  ConsumerState<_SendVerificationButton> createState() =>
      _SendVerificationButtonState();
}

class _SendVerificationButtonState
    extends ConsumerState<_SendVerificationButton> {
  bool _sending = false;
  bool _sent = false;

  Future<void> _send() async {
    if (_sending || _sent) return;
    setState(() => _sending = true);
    try {
      await ref
          .read(emailPreferencesRepositoryProvider)
          .sendVerificationEmail();
      if (mounted) setState(() { _sent = true; _sending = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Verification email sent — check your inbox')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        setState(() => _sending = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(extractErrorMessage(e)),
            backgroundColor: AppThemeTokens.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return TextButton.icon(
      onPressed: (_sending || _sent) ? null : _send,
      icon: _sending
          ? const SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: AppThemeTokens.warning),
            )
          : Icon(
              _sent ? Icons.check_rounded : Icons.send_outlined,
              size: 14,
              color: AppThemeTokens.warning,
            ),
      label: Text(
        _sent ? 'Email sent' : 'Send verification email',
        style: const TextStyle(
          fontSize: 12,
          color: AppThemeTokens.warning,
          fontWeight: FontWeight.w600,
        ),
      ),
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }
}
