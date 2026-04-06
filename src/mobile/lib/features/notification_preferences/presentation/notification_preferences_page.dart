import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/notification_preferences_repository_impl.dart';

class NotificationPreferencesPage extends ConsumerStatefulWidget {
  const NotificationPreferencesPage({super.key});

  @override
  ConsumerState<NotificationPreferencesPage> createState() =>
      _NotificationPreferencesPageState();
}

class _NotificationPreferencesPageState
    extends ConsumerState<NotificationPreferencesPage> {
  Map<String, bool>? _prefs;
  bool _saving = false;

  static const _labels = <String, String>{
    'eventJoin': 'Someone joins your event',
    'eventLeave': 'Someone leaves your event',
    'eventUpdate': 'Event is updated',
    'eventCancelled': 'Event is cancelled',
    'eventInvite': 'You are invited to an event',
    'groupJoin': 'Someone joins your group',
    'groupLeave': 'Someone leaves your group',
    'groupInvite': 'You are invited to a group',
    'joinRequest': 'New join request for your group',
    'teamUpResponse': 'Someone responds to your TeamUp request',
    'tournamentUpdate': 'Tournament update',
    'nearbyGroup': 'New group near you',
    'pushEnabled': 'Enable mobile push notifications',
    'pushEvents': 'Push notifications for event updates',
    'pushGroups': 'Push notifications for group updates',
    'pushTeamUp': 'Push notifications for TeamUp updates',
    'pushTournaments': 'Push notifications for tournament updates',
  };

  @override
  Widget build(BuildContext context) {
    final prefsAsync = ref.watch(notificationPreferencesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notification Preferences'),
        actions: [
          if (_prefs != null)
            TextButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Save'),
            ),
        ],
      ),
      body: prefsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppThemeTokens.darkTextSecondary, size: 48),
              const SizedBox(height: 12),
              Text(e.toString()),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => ref.invalidate(notificationPreferencesProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (serverPrefs) {
          _prefs ??= Map.of(serverPrefs);

          final displayPrefs = _prefs!;

          return ListView(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Text(
                  'Choose which notifications you want to receive.',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppThemeTokens.darkTextSecondary),
                ),
              ),
              ..._labels.entries.map((entry) {
                final key = entry.key;
                final label = entry.value;
                final value = displayPrefs[key] ?? true;
                return SwitchListTile(
                  title: Text(label),
                  value: value,
                  onChanged: (v) {
                    setState(() {
                      _prefs![key] = v;
                    });
                  },
                );
              }),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: SizedBox(
                  height: 48,
                  child: FilledButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Save Preferences'),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          );
        },
      ),
    );
  }

  Future<void> _save() async {
    if (_prefs == null) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(notificationPreferencesRepositoryProvider)
          .updatePreferences(_prefs!);
      ref.invalidate(notificationPreferencesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Preferences saved')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
