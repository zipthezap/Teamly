import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/user_model.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_mode_controller.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';

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

  String _errorMsg(Exception e) {
    if (e is DioException) {
      final inner = e.error;
      if (inner is AppException) return inner.message;
      return e.message ?? 'Network error';
    }
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
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
      final formData = FormData.fromMap({
        'profilePicture': await MultipartFile.fromFile(
          file.path,
          filename: 'profile.jpg',
        ),
      });
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
            content: Text(_errorMsg(e)),
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
            content: Text(_errorMsg(e)),
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
            content: Text(_errorMsg(e)),
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
        return 'System theme';
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
                value: ThemeMode.system,
                groupValue: selectedMode,
                onChanged: (value) => Navigator.of(context).pop(value),
                title: const Text('System'),
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
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      foregroundColor: AppThemeTokens.darkText,
      title: _editing
          ? const Text(
              'Edit Profile',
              style: TextStyle(
                color: AppThemeTokens.darkText,
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
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppThemeTokens.darkTextSecondary),
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
    final topPadding = MediaQuery.of(context).padding.top;
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: AppThemeTokens.heroGradient,
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
                  decoration: const BoxDecoration(
                    color: Color(0xFF0D1B2E),
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
                          ? AppThemeTokens.darkCardElevated
                          : null,
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: const Color(0xFF0D1B2E), width: 2.5),
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
            style: const TextStyle(
              color: AppThemeTokens.darkText,
              fontSize: 24,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 4),
          // Email
          Text(
            user.email,
            style: const TextStyle(
              color: AppThemeTokens.darkTextSecondary,
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
          else
            UiStatusBadge(
              label: 'Email not verified',
              status: UiStatusType.warning,
              dot: true,
            ),
          // Location row
          if ((user.city != null && user.city!.isNotEmpty) ||
              (user.country != null && user.country!.isNotEmpty)) ...[
            const SizedBox(height: 10),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.place_rounded,
                    size: 14, color: AppThemeTokens.darkTextMuted),
                const SizedBox(width: 4),
                Text(
                  [user.city, user.country]
                      .whereType<String>()
                      .where((s) => s.isNotEmpty)
                      .join(', '),
                  style: const TextStyle(
                    color: AppThemeTokens.darkTextMuted,
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: UiCard(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Personal info',
                style: TextStyle(
                  color: AppThemeTokens.darkText,
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
                        side: const BorderSide(
                            color: AppThemeTokens.darkBorder),
                        foregroundColor: AppThemeTokens.darkTextSecondary,
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
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: AppThemeTokens.darkCard.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
          border: Border.all(color: AppThemeTokens.darkBorder),
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCard.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.darkBorder),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              color: AppThemeTokens.darkText,
              fontSize: 22,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              color: AppThemeTokens.darkTextSecondary,
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
    return Padding(
      padding: const EdgeInsets.only(left: 2, bottom: 2),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          color: AppThemeTokens.darkTextMuted,
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
    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCard,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.darkBorder),
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
                color: AppThemeTokens.darkBorder.withValues(alpha: 0.6),
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
        style: const TextStyle(
          color: AppThemeTokens.darkText,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
      trailing: const Icon(
        Icons.arrow_forward_ios_rounded,
        size: 14,
        color: AppThemeTokens.darkTextMuted,
      ),
    );
  }
}
