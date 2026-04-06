import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/network/api_client.dart';

class TwoFactorPage extends ConsumerStatefulWidget {
  const TwoFactorPage({super.key});

  @override
  ConsumerState<TwoFactorPage> createState() => _TwoFactorPageState();
}

class _TwoFactorPageState extends ConsumerState<TwoFactorPage> {
  bool _loading = true;
  bool _enabled = false;
  String? _error;

  // Setup state
  bool _settingUp = false;
  String? _qrCode;
  String? _secret;
  final _tokenCtrl = TextEditingController();
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  @override
  void dispose() {
    _tokenCtrl.dispose();
    super.dispose();
  }

  String _extractMsg(Exception e) {
    if (e is DioException) {
      final inner = e.error;
      if (inner is AppException) return inner.message;
      return e.message ?? 'Network error';
    }
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _loadStatus() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final response = await dio.get<Map<String, dynamic>>('/2fa/status');
      final data = response.data!;
      setState(() {
        _enabled = (data['enabled'] as bool?) ?? false;
        _qrCode = data['qrCode'] as String?;
        _secret = data['secret'] as String?;
        _settingUp = false;
      });
    } on Exception catch (e) {
      setState(() => _error = _extractMsg(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _setUp2FA() async {
    setState(() => _settingUp = true);
    try {
      final dio = ref.read(dioProvider);
      final response =
          await dio.post<Map<String, dynamic>>('/2fa/setup');
      final data = response.data!;
      setState(() {
        _qrCode = data['qrCode'] as String?;
        _secret = data['secret'] as String?;
      });
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_extractMsg(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
        setState(() => _settingUp = false);
      }
    }
  }

  Future<void> _verify2FA() async {
    final code = _tokenCtrl.text.trim();
    if (code.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a 6-digit code')),
      );
      return;
    }
    setState(() => _verifying = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post<void>('/2fa/verify', data: {'token': code});
      _tokenCtrl.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Two-factor authentication enabled!')),
        );
      }
      await _loadStatus();
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_extractMsg(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _disable2FA() async {
    final passwordCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Disable 2FA'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
                'Enter your password to confirm disabling two-factor authentication.'),
            const SizedBox(height: 12),
            TextField(
              controller: passwordCtrl,
              decoration: const InputDecoration(
                labelText: 'Password',
                border: OutlineInputBorder(),
              ),
              obscureText: true,
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
                backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Disable'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      passwordCtrl.dispose();
      return;
    }

    try {
      final dio = ref.read(dioProvider);
      await dio.post<void>(
        '/2fa/disable',
        data: {'password': passwordCtrl.text},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Two-factor authentication disabled.')),
        );
      }
      await _loadStatus();
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_extractMsg(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      passwordCtrl.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Two-Factor Authentication')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.error_outline,
                            color: theme.colorScheme.error, size: 48),
                        const SizedBox(height: 12),
                        Text(_error!),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _loadStatus,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    // Status banner
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: _enabled
                            ? Colors.green.withOpacity(0.1)
                            : Colors.orange.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _enabled ? Colors.green : Colors.orange,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _enabled
                                ? Icons.verified_user_outlined
                                : Icons.security_outlined,
                            color: _enabled ? Colors.green : Colors.orange,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _enabled ? 'Enabled' : 'Disabled',
                                  style: theme.textTheme.titleSmall?.copyWith(
                                    color: _enabled
                                        ? Colors.green
                                        : Colors.orange,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  _enabled
                                      ? 'Your account is protected with 2FA.'
                                      : 'Add an extra layer of security to your account.',
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                          Chip(
                            label:
                                Text(_enabled ? 'Active' : 'Inactive'),
                            backgroundColor: _enabled
                                ? Colors.green.withOpacity(0.2)
                                : Colors.orange.withOpacity(0.2),
                            side: BorderSide.none,
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    if (!_enabled) ...[
                      if (!_settingUp) ...[
                        Text('Enable Two-Factor Authentication',
                            style: theme.textTheme.titleMedium),
                        const SizedBox(height: 8),
                        const Text(
                          'Two-factor authentication adds an extra layer of '
                          'security to your account. You will need an '
                          'authenticator app (such as Google Authenticator or '
                          'Authy) to complete sign-in.',
                        ),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: _setUp2FA,
                          icon: const Icon(Icons.lock_open_outlined),
                          label: const Text('Set Up 2FA'),
                        ),
                      ] else ...[
                        Text('Scan with Authenticator App',
                            style: theme.textTheme.titleMedium),
                        const SizedBox(height: 12),
                        const Text(
                          'Open your authenticator app and add a new account '
                          'by entering the secret key below manually.',
                        ),
                        const SizedBox(height: 16),
                        if (_secret != null) ...[
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: theme.colorScheme.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Secret Key',
                                    style: theme.textTheme.labelMedium
                                        ?.copyWith(color: Colors.grey)),
                                const SizedBox(height: 4),
                                SelectableText(
                                  _secret!,
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontFamily: 'monospace',
                                    letterSpacing: 2,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Enter this key in your authenticator app, then '
                            'type the 6-digit code it generates below.',
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: Colors.grey),
                          ),
                        ],
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _tokenCtrl,
                          decoration: const InputDecoration(
                            labelText: '6-digit verification code',
                            border: OutlineInputBorder(),
                            prefixIcon: Icon(Icons.pin_outlined),
                          ),
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                        ),
                        const SizedBox(height: 12),
                        FilledButton.icon(
                          onPressed: _verifying ? null : _verify2FA,
                          icon: _verifying
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.check_circle_outline),
                          label: const Text('Verify & Enable'),
                        ),
                        TextButton(
                          onPressed: () =>
                              setState(() => _settingUp = false),
                          child: const Text('Cancel'),
                        ),
                      ],
                    ] else ...[
                      Text('Disable Two-Factor Authentication',
                          style: theme.textTheme.titleMedium),
                      const SizedBox(height: 8),
                      const Text(
                        'Disabling 2FA will make your account less secure. '
                        'You will only need your password to sign in.',
                      ),
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: _disable2FA,
                        icon: const Icon(Icons.lock_open_outlined),
                        label: const Text('Disable 2FA'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: theme.colorScheme.error,
                          side: BorderSide(color: theme.colorScheme.error),
                        ),
                      ),
                    ],
                  ],
                ),
    );
  }
}
