import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/models/reminder_model.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/reminder_repository_impl.dart';

final _remindersProvider = FutureProvider<List<ReminderModel>>((ref) {
  return ref.watch(reminderRepositoryProvider).getReminders();
});

class RemindersPage extends ConsumerStatefulWidget {
  const RemindersPage({super.key});

  @override
  ConsumerState<RemindersPage> createState() => _RemindersPageState();
}

class _RemindersPageState extends ConsumerState<RemindersPage> {
  static const _minuteOptions = [15, 30, 60, 120, 1440];

  String _minutesLabel(int minutes) {
    switch (minutes) {
      case 15:
        return '15 min';
      case 30:
        return '30 min';
      case 60:
        return '1 hour';
      case 120:
        return '2 hours';
      case 1440:
        return '1 day';
      default:
        return '$minutes min';
    }
  }

  String _extractMsg(Exception e) =>
      e.toString().replaceFirst('Exception: ', '');

  Future<void> _showEditDialog(ReminderModel reminder) async {
    int selectedMinutes = reminder.minutesBefore;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Edit Reminder'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(reminder.eventTitle ?? 'Event ${reminder.eventId}'),
              const SizedBox(height: 16),
              const Text('Remind me:'),
              const SizedBox(height: 8),
              DropdownButton<int>(
                value: selectedMinutes,
                isExpanded: true,
                dropdownColor: AppThemeTokens.darkCardElevated,
                items: _minuteOptions
                    .map((m) => DropdownMenuItem(
                          value: m,
                          child: Text(_minutesLabel(m)),
                        ))
                    .toList(),
                onChanged: (v) {
                  if (v != null) setDialogState(() => selectedMinutes = v);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await ref
          .read(reminderRepositoryProvider)
          .updateReminder(reminder.id, selectedMinutes);
      ref.invalidate(_remindersProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reminder updated')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_extractMsg(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    }
  }

  Future<bool> _confirmDelete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Reminder'),
        content: const Text('Remove this reminder?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    return ok == true;
  }

  Future<void> _deleteReminder(String reminderId) async {
    try {
      await ref
          .read(reminderRepositoryProvider)
          .deleteReminder(reminderId);
      ref.invalidate(_remindersProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reminder deleted')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_extractMsg(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final remindersAsync = ref.watch(_remindersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Reminders'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(_remindersProvider),
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: AppThemeTokens.darkBorder),
        ),
      ),
      body: remindersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref.invalidate(_remindersProvider),
        ),
        data: (reminders) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(_remindersProvider),
          child: reminders.isEmpty
              ? const UiEmptyState(
                  icon: Icons.alarm_off_rounded,
                  title: 'No reminders',
                  message:
                      'Reminders you set for events\nwill appear here.',
                )
              : ListView.builder(
                  padding:
                      const EdgeInsets.fromLTRB(16, 12, 16, 32),
                  itemCount: reminders.length,
                  itemBuilder: (ctx, i) {
                    final r = reminders[i];
                    final eventLabel =
                        r.eventTitle ?? 'Event ${r.eventId}';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Dismissible(
                        key: ValueKey(r.id),
                        direction: DismissDirection.endToStart,
                        background: Container(
                          decoration: BoxDecoration(
                            color: AppThemeTokens.error
                                .withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(
                                AppThemeTokens.radiusMd),
                            border: Border.all(
                                color: AppThemeTokens.error
                                    .withValues(alpha: 0.4)),
                          ),
                          alignment: Alignment.centerRight,
                          padding: const EdgeInsets.only(right: 20),
                          child: const Icon(Icons.delete_rounded,
                              color: AppThemeTokens.error),
                        ),
                        confirmDismiss: (_) => _confirmDelete(),
                        onDismissed: (_) => _deleteReminder(r.id),
                        child: _ReminderCard(
                          reminder: r,
                          eventLabel: eventLabel,
                          minutesLabel: _minutesLabel(r.minutesBefore),
                          onEdit: () => _showEditDialog(r),
                          onDelete: () async {
                            if (await _confirmDelete()) {
                              _deleteReminder(r.id);
                            }
                          },
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

// ── Reminder card ─────────────────────────────────────────────────────────────

class _ReminderCard extends StatelessWidget {
  const _ReminderCard({
    required this.reminder,
    required this.eventLabel,
    required this.minutesLabel,
    required this.onEdit,
    required this.onDelete,
  });

  final ReminderModel reminder;
  final String eventLabel;
  final String minutesLabel;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final isPast = reminder.reminderTime.isBefore(DateTime.now());
    final accentColor =
        reminder.sent ? AppThemeTokens.success : AppThemeTokens.primary500;

    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCard,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.darkBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            // Icon container
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.12),
                borderRadius:
                    BorderRadius.circular(AppThemeTokens.radiusSm),
              ),
              child: Icon(
                reminder.sent
                    ? Icons.check_circle_rounded
                    : Icons.alarm_rounded,
                color: accentColor,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    eventLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: AppThemeTokens.darkText,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    DateFormat('EEE, MMM d · h:mm a')
                        .format(reminder.reminderTime.toLocal()),
                    style: TextStyle(
                      fontSize: 12,
                      color: isPast
                          ? AppThemeTokens.darkTextMuted
                          : AppThemeTokens.darkTextSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  // Time-before pill
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: Text(
                      '$minutesLabel before${reminder.sent ? ' · Sent' : ''}',
                      style: TextStyle(
                        fontSize: 11,
                        color: accentColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Actions
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ActionBtn(
                  icon: Icons.edit_rounded,
                  color: AppThemeTokens.info,
                  onTap: onEdit,
                ),
                const SizedBox(height: 6),
                _ActionBtn(
                  icon: Icons.delete_rounded,
                  color: AppThemeTokens.error,
                  onTap: onDelete,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
        ),
        child: Icon(icon, color: color, size: 16),
      ),
    );
  }
}
