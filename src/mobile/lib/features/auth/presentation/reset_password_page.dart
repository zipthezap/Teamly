import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/ui_primitives.dart';

/// Handles the `/reset-password/:token` deep link.
///
/// Presented when a user taps the password-reset link from their inbox.
/// Collects a new password and confirms it, then calls
/// `POST /auth/reset-password` with the token + new password.
class ResetPasswordPage extends ConsumerStatefulWidget {
  const ResetPasswordPage({super.key, required this.token});

  final String token;

  @override
  ConsumerState<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends ConsumerState<ResetPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _loading = false;
  bool _success = false;
  String? _errorMessage;

  @override
  void dispose() {
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final dio = ref.read(dioProvider);
      await dio.post<void>(
        '/auth/reset-password',
        data: {
          'token': widget.token,
          'newPassword': _passwordCtrl.text,
        },
      );
      if (mounted) setState(() { _success = true; _loading = false; });
    } on Exception catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = extractErrorMessage(e);
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppThemeTokens.darkBg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Reset Password'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: _success
            ? _SuccessView(onContinue: () => context.go('/auth'))
            : _FormView(
                formKey: _formKey,
                passwordCtrl: _passwordCtrl,
                confirmCtrl: _confirmCtrl,
                obscurePassword: _obscurePassword,
                obscureConfirm: _obscureConfirm,
                onTogglePassword: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
                onToggleConfirm: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
                loading: _loading,
                errorMessage: _errorMessage,
                onSubmit: _submit,
              ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Form view
// ---------------------------------------------------------------------------

class _FormView extends StatelessWidget {
  const _FormView({
    required this.formKey,
    required this.passwordCtrl,
    required this.confirmCtrl,
    required this.obscurePassword,
    required this.obscureConfirm,
    required this.onTogglePassword,
    required this.onToggleConfirm,
    required this.loading,
    required this.errorMessage,
    required this.onSubmit,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController passwordCtrl;
  final TextEditingController confirmCtrl;
  final bool obscurePassword;
  final bool obscureConfirm;
  final VoidCallback onTogglePassword;
  final VoidCallback onToggleConfirm;
  final bool loading;
  final String? errorMessage;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: AppThemeTokens.primary500.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.lock_reset_rounded,
                size: 36,
                color: AppThemeTokens.primary400,
              ),
            ),
            Text(
              'Choose a new password',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: AppThemeTokens.text(context),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Your new password must be at least 8 characters.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: AppThemeTokens.textSecondary(context),
              ),
            ),
            const SizedBox(height: 28),
            if (errorMessage != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppThemeTokens.errorBg,
                  borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                  border: Border.all(
                      color: AppThemeTokens.error.withValues(alpha: 0.35)),
                ),
                child: Text(
                  errorMessage!,
                  style: const TextStyle(
                      color: AppThemeTokens.error, fontSize: 13),
                ),
              ),
              const SizedBox(height: 16),
            ],
            Container(
              decoration: BoxDecoration(
                color: AppThemeTokens.card(context),
                borderRadius:
                    BorderRadius.circular(AppThemeTokens.radiusLg),
                border:
                    Border.all(color: AppThemeTokens.border(context)),
              ),
              padding: const EdgeInsets.all(20),
              child: Form(
                key: formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextFormField(
                      controller: passwordCtrl,
                      decoration: InputDecoration(
                        labelText: 'New password',
                        prefixIcon:
                            const Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          icon: Icon(obscurePassword
                              ? Icons.visibility_rounded
                              : Icons.visibility_off_rounded,
                              size: 20),
                          onPressed: onTogglePassword,
                        ),
                      ),
                      obscureText: obscurePassword,
                      validator: (v) {
                        if (v == null || v.isEmpty) {
                          return 'Password is required';
                        }
                        if (v.length < 8) {
                          return 'At least 8 characters required';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: confirmCtrl,
                      decoration: InputDecoration(
                        labelText: 'Confirm new password',
                        prefixIcon:
                            const Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          icon: Icon(obscureConfirm
                              ? Icons.visibility_rounded
                              : Icons.visibility_off_rounded,
                              size: 20),
                          onPressed: onToggleConfirm,
                        ),
                      ),
                      obscureText: obscureConfirm,
                      validator: (v) {
                        if (v != passwordCtrl.text) {
                          return 'Passwords do not match';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 24),
                    UiPrimaryButton(
                      text: 'Reset Password',
                      loading: loading,
                      onPressed: loading ? null : onSubmit,
                      icon: Icons.check_rounded,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Success view
// ---------------------------------------------------------------------------

class _SuccessView extends StatelessWidget {
  const _SuccessView({required this.onContinue});
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Spacer(),
          Container(
            width: 80,
            height: 80,
            margin: const EdgeInsets.only(bottom: 24),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppThemeTokens.successBg,
              shape: BoxShape.circle,
              border: Border.all(
                  color: AppThemeTokens.success.withValues(alpha: 0.3)),
            ),
            child: const Icon(Icons.check_rounded,
                size: 40, color: AppThemeTokens.success),
          ),
          Text(
            'Password reset!',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppThemeTokens.text(context),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Your password has been changed. You can now sign in with your new password.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: AppThemeTokens.textSecondary(context),
            ),
          ),
          const Spacer(),
          FilledButton.icon(
            onPressed: onContinue,
            icon: const Icon(Icons.login_rounded),
            label: const Text('Go to Sign In'),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
