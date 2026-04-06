import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/models/reminder_model.dart';
import '../../../shared/widgets/error_display.dart';
import '../data/reminder_repository_impl.dart';
import '../domain/reminder_repository.dart';

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
                items: _minuteOptions
                    .map((m) => DropdownMenuItem(
                          value: m,
                          child: Text(_minutesLabel(m)),
                        ))
                    .toList(),
                onChanged: (v) {
                  if (v != null) {
                    setDialogState(() => selectedMinutes = v);
                  }
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
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Reminders'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_remindersProvider),
          ),
        ],
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
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.alarm_off_outlined,
                          size: 48, color: Colors.grey),
                      SizedBox(height: 12),
                      Text('No reminders set.',
                          style: TextStyle(color: Colors.grey)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: reminders.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (ctx, i) {
                    final r = reminders[i];
                    final eventLabel =
                        r.eventTitle ?? 'Event ${r.eventId}';
                    return Dismissible(
                      key: ValueKey(r.id),
                      direction: DismissDirection.endToStart,
                      background: Container(
                        color: theme.colorScheme.error,
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.only(right: 16),
                        child: const Icon(Icons.delete_outline,
                            color: Colors.white),
                      ),
                      confirmDismiss: (_) async {
                        return await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Delete Reminder'),
                            content: const Text(
                                'Remove this reminder?'),
                            actions: [
                              TextButton(
                                onPressed: () =>
                                    Navigator.of(ctx).pop(false),
                                child: const Text('Cancel'),
                              ),
                              FilledButton(
                                style: FilledButton.styleFrom(
                                    backgroundColor:
                                        theme.colorScheme.error),
                                onPressed: () =>
                                    Navigator.of(ctx).pop(true),
                                child: const Text('Delete'),
                              ),
                            ],
                          ),
                        );
                      },
                      onDismissed: (_) => _deleteReminder(r.id),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor:
                              theme.colorScheme.primaryContainer,
                          child: Icon(
                            Icons.alarm_outlined,
                            color: theme.colorScheme.onPrimaryContainer,
                          ),
                        ),
                        title: Text(eventLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              DateFormat('MMM d, y · h:mm a')
                                  .format(r.reminderTime.toLocal()),
                              style: theme.textTheme.bodySmall,
                            ),
                            Text(
                              '${_minutesLabel(r.minutesBefore)} before',
                              style: theme.textTheme.labelSmall
                                  ?.copyWith(color: Colors.grey),
                            ),
                          ],
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (r.sent)
                              const Tooltip(
                                message: 'Sent',
                                child: Icon(Icons.check_circle_outline,
                                    size: 16, color: Colors.green),
                              ),
                            IconButton(
                              icon: const Icon(Icons.edit_outlined),
                              onPressed: () => _showEditDialog(r),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline),
                              onPressed: () => _deleteReminder(r.id),
                            ),
                          ],
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
