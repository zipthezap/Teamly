import 'package:flutter/material.dart';
import '../../../core/error/error_utils.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/ui_primitives.dart';
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

  // Sections: title, icon, color, list of (key, label, subtitle?)
  static const _sections = <_Section>[
    _Section(
      title: 'Events',
      icon: Icons.event_rounded,
      color: Color(0xFF2196F3),
      items: [
        _PrefItem('eventJoin', 'Someone joins your event',
            'Notified when a participant joins'),
        _PrefItem('eventLeave', 'Someone leaves your event',
            'Notified when a participant leaves'),
        _PrefItem('eventUpdate', 'Event is updated',
            'Changes to time, location or details'),
        _PrefItem('eventCancelled', 'Event is cancelled', null),
        _PrefItem('eventInvite', 'You are invited to an event', null),
      ],
    ),
    _Section(
      title: 'Groups',
      icon: Icons.groups_2_rounded,
      color: Color(0xFF7C4DFF),
      items: [
        _PrefItem('groupJoin', 'Someone joins your group', null),
        _PrefItem('groupLeave', 'Someone leaves your group', null),
        _PrefItem('groupInvite', 'You are invited to a group', null),
        _PrefItem(
            'joinRequest', 'New join request', 'For groups you manage'),
      ],
    ),
    _Section(
      title: 'TeamUp & Tournaments',
      icon: Icons.emoji_events_rounded,
      color: Color(0xFFFF9800),
      items: [
        _PrefItem('teamUpResponse', 'TeamUp response',
            'When someone responds to your request'),
        _PrefItem('tournamentUpdate', 'Tournament update', null),
        _PrefItem('nearbyGroup', 'New group near you', null),
      ],
    ),
    _Section(
      title: 'Push Notifications',
      icon: Icons.notifications_active_rounded,
      color: Color(0xFF4CAF50),
      items: [
        _PrefItem('pushEnabled', 'Enable mobile push',
            'Master toggle for push notifications'),
        _PrefItem('pushEvents', 'Event push notifications', null),
        _PrefItem('pushGroups', 'Group push notifications', null),
        _PrefItem('pushTeamUp', 'TeamUp push notifications', null),
        _PrefItem(
            'pushTournaments', 'Tournament push notifications', null),
      ],
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final prefsAsync = ref.watch(notificationPreferencesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notification Preferences'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(height: 1, color: AppThemeTokens.border(context)),
        ),
      ),
      body: prefsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => UiEmptyState(
          icon: Icons.error_outline_rounded,
          title: 'Failed to load',
          message: extractErrorMessage(e),
          action: () => ref.invalidate(notificationPreferencesProvider),
          actionLabel: 'Retry',
        ),
        data: (serverPrefs) {
          _prefs ??= Map.of(serverPrefs);
          final displayPrefs = _prefs!;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  'Choose which notifications you want to receive.',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppThemeTokens.textSecondary(context),
                  ),
                ),
              ),
              for (final section in _sections) ...[
                _SectionHeader(
                    title: section.title,
                    icon: section.icon,
                    color: section.color),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: AppThemeTokens.card(context),
                    borderRadius:
                        BorderRadius.circular(AppThemeTokens.radiusMd),
                    border:
                        Border.all(color: AppThemeTokens.border(context)),
                  ),
                  child: Column(
                    children: [
                      for (int i = 0;
                          i < section.items.length;
                          i++) ...[
                        _ToggleRow(
                          item: section.items[i],
                          color: section.color,
                          value: displayPrefs[section.items[i].key] ??
                              true,
                          onChanged: (v) =>
                              setState(() => _prefs![section.items[i].key] = v),
                        ),
                        if (i < section.items.length - 1)
                          Divider(
                              height: 1,
                              indent: 60,
                              color: AppThemeTokens.border(context)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              UiPrimaryButton(
                text: 'Save Preferences',
                onPressed: _saving ? null : _save,
                loading: _saving,
                icon: Icons.save_rounded,
              ),
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
            content:
                Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

// ── Data classes ──────────────────────────────────────────────────────────────

class _Section {
  const _Section({
    required this.title,
    required this.icon,
    required this.color,
    required this.items,
  });

  final String title;
  final IconData icon;
  final Color color;
  final List<_PrefItem> items;
}

class _PrefItem {
  const _PrefItem(this.key, this.label, this.subtitle);
  final String key;
  final String label;
  final String? subtitle;
}

// ── Widgets ───────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.icon,
    required this.color,
  });

  final String title;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            borderRadius:
                BorderRadius.circular(AppThemeTokens.radiusSm),
          ),
          child: Icon(icon, color: color, size: 14),
        ),
        const SizedBox(width: 8),
        Text(
          title.toUpperCase(),
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: AppThemeTokens.textSecondary(context),
            letterSpacing: 1.0,
          ),
        ),
      ],
    );
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.item,
    required this.color,
    required this.value,
    required this.onChanged,
  });

  final _PrefItem item;
  final Color color;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: value
                  ? color.withValues(alpha: 0.12)
                  : AppThemeTokens.cardElevated(context),
              borderRadius:
                  BorderRadius.circular(AppThemeTokens.radiusSm),
            ),
            child: Icon(
              Icons.notifications_rounded,
              color: value ? color : AppThemeTokens.textMuted(context),
              size: 17,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: value
                        ? AppThemeTokens.text(context)
                        : AppThemeTokens.textSecondary(context),
                  ),
                ),
                if (item.subtitle != null)
                  Text(
                    item.subtitle!,
                    style: TextStyle(
                      fontSize: 11,
                      color: AppThemeTokens.textMuted(context),
                    ),
                  ),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}
