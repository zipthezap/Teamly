import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/user_model.dart';
import '../../../core/network/api_client.dart';
import '../../../features/auth/state/auth_notifier.dart';
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

      // Refresh profile in auth state
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
                decoration: const InputDecoration(
                  labelText: 'Current password',
                  border: OutlineInputBorder(),
                ),
                obscureText: true,
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: newPwCtrl,
                decoration: const InputDecoration(
                  labelText: 'New password',
                  border: OutlineInputBorder(),
                ),
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
                decoration: const InputDecoration(
                  labelText: 'Confirm new password',
                  border: OutlineInputBorder(),
                ),
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

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState.user;
    final theme = Theme.of(context);

    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          if (!_editing)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit profile',
              onPressed: () => setState(() => _editing = true),
            )
          else ...[
            TextButton(
              onPressed: () => setState(() => _editing = false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: _saving ? null : _saveProfile,
              child: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Save'),
            ),
          ],
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Avatar + name header
          Center(
            child: Column(
              children: [
                Stack(
                  children: [
                    UserAvatar(
                      name: user.name,
                      imageUrl: user.profilePicture,
                      radius: 42,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: GestureDetector(
                        onTap: _uploadingPicture
                            ? null
                            : _pickAndUploadProfilePicture,
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Theme.of(context).scaffoldBackgroundColor,
                              width: 2,
                            ),
                          ),
                          child: _uploadingPicture
                              ? const Padding(
                                  padding: EdgeInsets.all(6),
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.camera_alt,
                                  size: 14, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (!_editing) ...[
                  Text(user.name, style: theme.textTheme.titleLarge),
                  Text(
                    user.email,
                    style: theme.textTheme.bodySmall?.copyWith(color: AppThemeTokens.darkTextSecondary),
                  ),
                  if (!user.emailVerified)
                    const Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Chip(
                        label: Text('Email not verified'),
                        backgroundColor: Colors.orange,
                      ),
                    ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 24),

          if (_editing) ...[
            // Edit form
            Form(
              key: _formKey,
              child: Column(
                children: [
                  TextFormField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Full name',
                      prefixIcon: Icon(Icons.person_outline),
                      border: OutlineInputBorder(),
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
                      border: OutlineInputBorder(),
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
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _countryCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Country (optional)',
                      prefixIcon: Icon(Icons.flag_outlined),
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Divider(),
          ] else ...[
            // View-only location
            if (user.city != null || user.country != null)
              ListTile(
                leading: const Icon(Icons.place_outlined),
                title: Text(
                  [user.city, user.country].whereType<String>().join(', '),
                ),
                subtitle: const Text('Location'),
              ),
            const Divider(),
          ],

          // Change password
          ListTile(
            leading: const Icon(Icons.lock_outline),
            title: const Text('Change password'),
            trailing: const Icon(Icons.chevron_right),
            onTap: _changePassword,
          ),

          const Divider(),

          // Two-factor authentication
          ListTile(
            leading: const Icon(Icons.security_outlined),
            title: const Text('Two-factor authentication'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/profile/two-factor'),
          ),

          const Divider(),

          // Notification preferences
          ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Notification preferences'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/profile/notification-preferences'),
          ),

          const Divider(),

          // Active sessions
          ListTile(
            leading: const Icon(Icons.devices_outlined),
            title: const Text('Active sessions'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/profile/sessions'),
          ),

          const Divider(),

          // Profile picture history
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Profile picture history'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/profile/pictures'),
          ),

          const Divider(),

          // Connected accounts (OAuth)
          ListTile(
            leading: const Icon(Icons.link_outlined),
            title: const Text('Connected accounts'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/profile/connected-accounts'),
          ),

          const Divider(),

          // Reminders
          ListTile(
            leading: const Icon(Icons.alarm_outlined),
            title: const Text('My reminders'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/profile/reminders'),
          ),

          const Divider(),

          // Sign out
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Sign out', style: TextStyle(color: Colors.red)),
            onTap: () async {
              await ref.read(authNotifierProvider.notifier).logout();
              if (context.mounted) context.go('/auth');
            },
          ),
        ],
      ),
    );
  }
}
