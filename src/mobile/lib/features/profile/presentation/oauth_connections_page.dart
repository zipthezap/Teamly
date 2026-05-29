import 'package:flutter/material.dart';
import '../../../core/error/error_utils.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/extended_models.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/error_display.dart';

final _oauthStatusProvider = FutureProvider<OAuthStatusModel>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get<Map<String, dynamic>>('/auth/oauth/status');
  return OAuthStatusModel.fromJson(response.data!);
});

class OAuthConnectionsPage extends ConsumerWidget {
  const OAuthConnectionsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusAsync = ref.watch(_oauthStatusProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Connected Accounts'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_oauthStatusProvider),
          ),
        ],
      ),
      body: statusAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: extractErrorMessage(e),
          onRetry: () => ref.invalidate(_oauthStatusProvider),
        ),
        data: (status) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Manage social accounts linked to your Teamly profile.',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: AppThemeTokens.textSecondary(context)),
            ),
            const SizedBox(height: 8),
            // Info banner explaining how to link a new account
            if (!status.googleConnected || !status.facebookConnected)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppThemeTokens.info.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: AppThemeTokens.info.withValues(alpha: 0.25)),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline,
                        size: 16, color: AppThemeTokens.info),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'To link a new social account, sign out and sign in with that provider. '
                        'Your accounts will be merged automatically.',
                        style:
                            TextStyle(fontSize: 12, color: AppThemeTokens.info),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 4),

            // Google
            _ConnectionTile(
              icon: Icons.g_mobiledata,
              iconColor: AppThemeTokens.error,
              provider: 'Google',
              connected: status.googleConnected,
              isPrimary: status.primaryProvider == 'google',
              onUnlink: () => _unlinkOAuth(context, ref, 'google'),
            ),

            const Divider(),

            // Facebook
            _ConnectionTile(
              icon: Icons.facebook,
              iconColor: AppThemeTokens.info,
              provider: 'Facebook',
              connected: status.facebookConnected,
              isPrimary: status.primaryProvider == 'facebook',
              onUnlink: () => _unlinkOAuth(context, ref, 'facebook'),
            ),

            const Divider(),

            // Local password indicator
            ListTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppThemeTokens.success.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.lock_outline,
                    color: AppThemeTokens.success),
              ),
              title: const Text('Password'),
              subtitle: Text(status.hasLocalPassword
                  ? 'Password is set'
                  : 'No password — sign in only via social accounts'),
              trailing: status.hasLocalPassword
                  ? const Icon(Icons.check_circle,
                      color: AppThemeTokens.success)
                  : null,
            ),

            if (status.hasOAuthProfilePicture == true) ...[
              const SizedBox(height: 16),
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline,
                          size: 18, color: AppThemeTokens.info),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Your profile picture is synced from your social account.',
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _unlinkOAuth(
      BuildContext context, WidgetRef ref, String provider) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Unlink $provider'),
        content: Text(
            'Remove $provider connection? You can still sign in with your password.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error),
            child: const Text('Unlink'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      final dio = ref.read(dioProvider);
      await dio.delete<void>('/auth/oauth/$provider');
      ref.invalidate(_oauthStatusProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$provider unlinked successfully')),
        );
      }
    } on Exception catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(extractErrorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }
}

class _ConnectionTile extends StatelessWidget {
  const _ConnectionTile({
    required this.icon,
    required this.iconColor,
    required this.provider,
    required this.connected,
    required this.isPrimary,
    required this.onUnlink,
  });

  final IconData icon;
  final Color iconColor;
  final String provider;
  final bool connected;
  final bool isPrimary;
  final VoidCallback onUnlink;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: iconColor),
      ),
      title: Text(provider),
      subtitle: Text(connected
          ? isPrimary
              ? 'Connected (primary account)'
              : 'Connected'
          : 'Not connected — sign out and sign in with $provider to link'),
      trailing: connected
          ? isPrimary
              ? const Tooltip(
                  message: 'Cannot unlink primary account',
                  child:
                      Icon(Icons.check_circle, color: AppThemeTokens.success),
                )
              : TextButton(
                  onPressed: onUnlink,
                  child: const Text('Unlink',
                      style: TextStyle(color: AppThemeTokens.error)),
                )
          : Icon(Icons.link_off_rounded,
              color: AppThemeTokens.textSecondary(context), size: 20),
    );
  }
}
