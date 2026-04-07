import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/session_model.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/error_display.dart';

final _sessionsProvider = FutureProvider<List<SessionModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get<Map<String, dynamic>>('/auth/sessions');
  final items = response.data?['sessions'] as List<dynamic>? ?? [];
  return items
      .map((e) => SessionModel.fromJson(e as Map<String, dynamic>))
      .toList();
});

class SessionsPage extends ConsumerWidget {
  const SessionsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(_sessionsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Active Sessions'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_sessionsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // Revoke all sessions button
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: OutlinedButton.icon(
              onPressed: () => _revokeAllSessions(context, ref),
              icon: const Icon(Icons.logout, color: AppThemeTokens.error),
              label: const Text(
                'Sign out of all other devices',
                style: TextStyle(color: AppThemeTokens.error),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppThemeTokens.error),
                minimumSize: const Size(double.infinity, 44),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Text(
              'Your account is currently active on these devices.',
              style: TextStyle(fontSize: 12, color: AppThemeTokens.darkTextSecondary),
            ),
          ),
          const Divider(),
          Expanded(
            child: sessionsAsync.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorDisplay(
                message: e.toString(),
                onRetry: () => ref.invalidate(_sessionsProvider),
              ),
              data: (sessions) {
                if (sessions.isEmpty) {
                  return Center(
                    child: Text(
                      'No sessions found.',
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(color: AppThemeTokens.darkTextSecondary),
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(_sessionsProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    itemCount: sessions.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1, indent: 16),
                    itemBuilder: (ctx, i) {
                      final session = sessions[i];
                      return _SessionTile(
                        session: session,
                        onRevoke: () =>
                            _revokeSession(context, ref, session.id),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _revokeSession(
      BuildContext context, WidgetRef ref, String sessionId) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Revoke session'),
        content: const Text(
            'This device will be signed out. Continue?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      final dio = ref.read(dioProvider);
      await dio.delete<void>('/auth/sessions/$sessionId');
      ref.invalidate(_sessionsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Session revoked')),
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

  Future<void> _revokeAllSessions(
      BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out of all devices'),
        content: const Text(
            'All other active sessions will be terminated. You will remain signed in on this device.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error),
            child: const Text('Sign Out All'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      final dio = ref.read(dioProvider);
      await dio.post<void>('/auth/logout-all');
      ref.invalidate(_sessionsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Signed out of all other devices')),
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

class _SessionTile extends StatelessWidget {
  const _SessionTile({required this.session, required this.onRevoke});

  final SessionModel session;
  final VoidCallback onRevoke;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isExpired = session.isExpired;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: isExpired
            ? theme.colorScheme.errorContainer
            : theme.colorScheme.primaryContainer,
        child: Icon(
          Icons.devices_outlined,
          color: isExpired
              ? theme.colorScheme.onErrorContainer
              : theme.colorScheme.onPrimaryContainer,
        ),
      ),
      title: Text(
        _parseDevice(session.deviceInfo),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (session.ipAddress != null)
            Text('IP: ${session.ipAddress}',
                style: const TextStyle(fontSize: 11)),
          Text(
            'Last active: ${_formatDate(session.lastActive)}',
            style: const TextStyle(fontSize: 11),
          ),
          if (isExpired)
            const Text('Expired',
                style: TextStyle(
                    fontSize: 11,
                    color: AppThemeTokens.error,
                    fontWeight: FontWeight.bold)),
        ],
      ),
      isThreeLine: true,
      trailing: IconButton(
        icon: const Icon(Icons.logout, color: AppThemeTokens.error),
        tooltip: 'Revoke session',
        onPressed: onRevoke,
      ),
    );
  }

  String _parseDevice(String? deviceInfo) {
    if (deviceInfo == null || deviceInfo.isEmpty) return 'Unknown device';
    // Show truncated user-agent as a friendly name
    if (deviceInfo.contains('iPhone') || deviceInfo.contains('iOS')) {
      return 'iPhone / iOS';
    }
    if (deviceInfo.contains('Android')) return 'Android device';
    if (deviceInfo.contains('Windows')) return 'Windows PC';
    if (deviceInfo.contains('Macintosh') || deviceInfo.contains('Mac OS')) {
      return 'Mac';
    }
    if (deviceInfo.contains('Linux')) return 'Linux';
    return deviceInfo.length > 40
        ? '${deviceInfo.substring(0, 40)}…'
        : deviceInfo;
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt.toLocal());
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return DateFormat('MMM d, y').format(dt.toLocal());
  }
}
