import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/extended_models.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/error_display.dart';

final _oauthStatusProvider =
    FutureProvider<OAuthStatusModel>((ref) async {
  final dio = ref.watch(dioProvider);
  final response =
      await dio.get<Map<String, dynamic>>('/auth/oauth/status');
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
          message: e.toString(),
          onRetry: () => ref.invalidate(_oauthStatusProvider),
        ),
        data: (status) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Link social accounts for easy sign-in.',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: Colors.grey),
            ),
            const SizedBox(height: 16),

            // Google
            _ConnectionTile(
              icon: Icons.g_mobiledata,
              iconColor: Colors.red,
              provider: 'Google',
              connected: status.googleConnected,
              isPrimary: status.primaryProvider == 'google',
              onLink: () => _linkOAuth(context, ref, 'google'),
              onUnlink: () => _unlinkOAuth(context, ref, 'google'),
            ),

            const Divider(),

            // Facebook
            _ConnectionTile(
              icon: Icons.facebook,
              iconColor: Colors.blue.shade700,
              provider: 'Facebook',
              connected: status.facebookConnected,
              isPrimary: status.primaryProvider == 'facebook',
              onLink: () => _linkOAuth(context, ref, 'facebook'),
              onUnlink: () => _unlinkOAuth(context, ref, 'facebook'),
            ),

            const Divider(),

            // Local password indicator
            ListTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.lock_outline, color: Colors.green),
              ),
              title: const Text('Password'),
              subtitle: Text(status.hasLocalPassword
                  ? 'Password is set'
                  : 'No password — sign in only via social accounts'),
              trailing: status.hasLocalPassword
                  ? const Icon(Icons.check_circle, color: Colors.green)
                  : null,
            ),

            if (status.hasOAuthProfilePicture == true) ...[
              const SizedBox(height: 16),
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, size: 18, color: Colors.blue),
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

  Future<void> _linkOAuth(
      BuildContext context, WidgetRef ref, String provider) async {
    // Inform user to sign in via OAuth
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'To link $provider, sign out and sign in with $provider.'),
        ),
      );
    }
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
        final msg = e is AppException
            ? e.message
            : e.toString().replaceFirst('Exception: ', '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
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
    required this.onLink,
    required this.onUnlink,
  });

  final IconData icon;
  final Color iconColor;
  final String provider;
  final bool connected;
  final bool isPrimary;
  final VoidCallback onLink;
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
          : 'Not connected'),
      trailing: connected
          ? isPrimary
              ? const Tooltip(
                  message: 'Cannot unlink primary account',
                  child:
                      Icon(Icons.check_circle, color: Colors.green),
                )
              : TextButton(
                  onPressed: onUnlink,
                  child: const Text('Unlink',
                      style: TextStyle(color: Colors.red)),
                )
          : FilledButton.tonal(
              onPressed: onLink,
              child: const Text('Link'),
            ),
    );
  }
}
