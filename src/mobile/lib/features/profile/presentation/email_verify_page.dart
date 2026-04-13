import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/profile/data/email_preferences_repository_impl.dart';

/// Handles the `/email/verify/:token` deep link.
///
/// Shown when the user taps the verification link in their inbox.
/// Immediately calls the backend to verify the token, then shows
/// success or failure feedback with an action to continue.
class EmailVerifyPage extends ConsumerStatefulWidget {
  const EmailVerifyPage({super.key, required this.token});

  final String token;

  @override
  ConsumerState<EmailVerifyPage> createState() => _EmailVerifyPageState();
}

class _EmailVerifyPageState extends ConsumerState<EmailVerifyPage> {
  bool _loading = true;
  bool _success = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _verify();
  }

  Future<void> _verify() async {
    try {
      await ref
          .read(emailPreferencesRepositoryProvider)
          .verifyEmail(widget.token);
      // Reload auth profile so emailVerified flag updates in the app state.
      // The user will see the updated badge on next profile page visit.
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
      appBar: AppBar(
        title: const Text('Email Verification'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _success
                  ? _SuccessView(onContinue: () => context.go('/dashboard'))
                  : _ErrorView(
                      message: _errorMessage ?? 'Verification failed.',
                      onRetry: () {
                        setState(() { _loading = true; _errorMessage = null; });
                        _verify();
                      },
                      onDismiss: () => context.go('/dashboard'),
                    ),
        ),
      ),
    );
  }
}

class _SuccessView extends StatelessWidget {
  const _SuccessView({required this.onContinue});
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return Column(
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
          'Email verified!',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: AppThemeTokens.text(context),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Your email address has been successfully verified.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            color: AppThemeTokens.textSecondary(context),
          ),
        ),
        const Spacer(),
        FilledButton.icon(
          onPressed: onContinue,
          icon: const Icon(Icons.arrow_forward_rounded),
          label: const Text('Continue to app'),
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({
    required this.message,
    required this.onRetry,
    required this.onDismiss,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Column(
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
            color: AppThemeTokens.errorBg,
            shape: BoxShape.circle,
            border:
                Border.all(color: AppThemeTokens.error.withValues(alpha: 0.3)),
          ),
          child: const Icon(Icons.close_rounded,
              size: 40, color: AppThemeTokens.error),
        ),
        Text(
          'Verification failed',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: AppThemeTokens.text(context),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            color: AppThemeTokens.textSecondary(context),
          ),
        ),
        const Spacer(),
        FilledButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry'),
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
        const SizedBox(height: 10),
        OutlinedButton(
          onPressed: onDismiss,
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: const Text('Back to app'),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}
