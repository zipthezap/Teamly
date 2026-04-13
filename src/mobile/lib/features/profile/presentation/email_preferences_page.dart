import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/email_preferences_repository_impl.dart';

class EmailPreferencesPage extends ConsumerStatefulWidget {
  const EmailPreferencesPage({super.key});

  @override
  ConsumerState<EmailPreferencesPage> createState() =>
      _EmailPreferencesPageState();
}

class _EmailPreferencesPageState extends ConsumerState<EmailPreferencesPage> {
  Map<String, dynamic>? _prefs;
  bool _saving = false;

  static const _sections = <_Section>[
    _Section(
      title: 'Sessions',
      icon: Icons.event_rounded,
      color: Color(0xFF2196F3),
      items: [
        _PrefItem('sessionInvites', 'Session invitations',
            'When you are invited to a session'),
        _PrefItem('sessionReminders', 'Session reminders',
            'Before a session you have joined'),
        _PrefItem('sessionUpdates', 'Session updates',
            'Changes to time, location or details'),
        _PrefItem('sessionCancellations', 'Session cancellations',
            'When a session you joined is cancelled'),
      ],
    ),
    _Section(
      title: 'Groups',
      icon: Icons.groups_2_rounded,
      color: Color(0xFF7C4DFF),
      items: [
        _PrefItem('groupInvites', 'Group invitations',
            'When you are invited to a group'),
        _PrefItem('commentMentions', 'Comment mentions',
            'When someone mentions you in a comment'),
      ],
    ),
    _Section(
      title: 'TeamUp',
      icon: Icons.handshake_rounded,
      color: Color(0xFFFF9800),
      items: [
        _PrefItem('nearbyTeamUps', 'Nearby TeamUp requests',
            'TeamUp requests close to your location'),
      ],
    ),
  ];

  // Keys that are "mute" flags — their UI is inverted (true = suppress emails).
  static const _muteItems = <_PrefItem>[
    _PrefItem('muteSessionInvites', 'Mute session invite emails', null),
    _PrefItem('muteSessionReminders', 'Mute session reminder emails', null),
    _PrefItem('muteSessionUpdates', 'Mute session update emails', null),
    _PrefItem('muteSessionCancellations', 'Mute cancellation emails', null),
    _PrefItem('muteGroupInvites', 'Mute group invite emails', null),
    _PrefItem('muteGroupRequests', 'Mute join-request emails', null),
    _PrefItem('muteNearbyGroups', 'Mute nearby-group emails', null),
    _PrefItem('muteSessionCreated', 'Mute new-session emails', null),
    _PrefItem('muteNearbyTeamUps', 'Mute nearby TeamUp emails', null),
  ];

  @override
  Widget build(BuildContext context) {
    final prefsAsync = ref.watch(emailPreferencesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Email Preferences'),
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
          action: () => ref.invalidate(emailPreferencesProvider),
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
                  'Choose which email notifications you want to receive.',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppThemeTokens.textSecondary(context),
                  ),
                ),
              ),
              // ── Positive toggles (enabled = send emails) ───────────
              for (final section in _sections) ...[
                _SectionHeader(
                    title: section.title,
                    icon: section.icon,
                    color: section.color),
                const SizedBox(height: 8),
                _buildToggleCard(context, section.items, displayPrefs,
                    section.color),
                const SizedBox(height: 16),
              ],
              // ── Mute overrides (enabled = suppress emails) ─────────
              _SectionHeader(
                  title: 'Mute Overrides',
                  icon: Icons.notifications_off_rounded,
                  color: AppThemeTokens.error),
              const SizedBox(height: 4),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'These mute flags suppress individual email types even when the main toggle above is on.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppThemeTokens.textMuted(context),
                  ),
                ),
              ),
              _buildToggleCard(
                  context, _muteItems, displayPrefs, AppThemeTokens.error),
              const SizedBox(height: 24),
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

  Widget _buildToggleCard(BuildContext context, List<_PrefItem> items,
      Map<String, dynamic> prefs, Color color) {
    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.card(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      child: Column(
        children: [
          for (int i = 0; i < items.length; i++) ...[
            _ToggleRow(
              item: items[i],
              color: color,
              value: (prefs[items[i].key] as bool?) ?? true,
              onChanged: (v) => setState(() => _prefs![items[i].key] = v),
            ),
            if (i < items.length - 1)
              Divider(
                  height: 1,
                  indent: 60,
                  color: AppThemeTokens.border(context)),
          ],
        ],
      ),
    );
  }

  Future<void> _save() async {
    if (_prefs == null) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(emailPreferencesRepositoryProvider)
          .updatePreferences(_prefs!);
      ref.invalidate(emailPreferencesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Email preferences saved')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(extractErrorMessage(e)),
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
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
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
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
            ),
            child: Icon(
              Icons.email_outlined,
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
