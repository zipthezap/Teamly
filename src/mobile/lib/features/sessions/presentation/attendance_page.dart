import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/error/error_utils.dart';import '../../../core/models/attendance_model.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../data/session_repository_impl.dart';
import '../state/sessions_notifier.dart';

class AttendancePage extends ConsumerStatefulWidget {
  const AttendancePage({super.key, required this.eventId, this.eventTitle});

  final String eventId;
  final String? eventTitle;

  @override
  ConsumerState<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends ConsumerState<AttendancePage> {
  bool _markingAttendance = false;

  Future<void> _markAttendance(String status) async {
    setState(() => _markingAttendance = true);
    try {
      await ref
          .read(sessionRepositoryProvider)
          .markAttendance(widget.eventId, status);
      ref.invalidate(attendanceProvider(widget.eventId));
      ref.invalidate(attendanceStatsProvider(widget.eventId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(status == 'on-time'
                ? 'Marked as on time!'
                : 'Marked as late!'),
          ),
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
      if (mounted) setState(() => _markingAttendance = false);
    }
  }

  Future<void> _deleteAttendance(String userId) async {
    try {
      await ref
          .read(sessionRepositoryProvider)
          .deleteAttendance(widget.eventId, userId);
      ref.invalidate(attendanceProvider(widget.eventId));
      ref.invalidate(attendanceStatsProvider(widget.eventId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Attendance record removed')),
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
    }
  }

  @override
  Widget build(BuildContext context) {
    final attendanceAsync = ref.watch(attendanceProvider(widget.eventId));
    final statsAsync = ref.watch(attendanceStatsProvider(widget.eventId));
    final currentUserId = ref.watch(authNotifierProvider).user?.id;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.eventTitle != null
            ? 'Attendance – ${widget.eventTitle}'
            : 'Attendance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(attendanceProvider(widget.eventId));
              ref.invalidate(attendanceStatsProvider(widget.eventId));
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(attendanceProvider(widget.eventId));
          ref.invalidate(attendanceStatsProvider(widget.eventId));
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Mark my own attendance
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Mark My Attendance',
                        style: theme.textTheme.titleMedium),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: _markingAttendance
                                ? null
                                : () => _markAttendance('on-time'),
                            icon: const Icon(Icons.check_circle_outline),
                            label: const Text('On Time'),
                            style: FilledButton.styleFrom(
                              backgroundColor: AppThemeTokens.success,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _markingAttendance
                                ? null
                                : () => _markAttendance('late'),
                            icon: const Icon(Icons.schedule),
                            label: const Text('Late'),
                          ),
                        ),
                      ],
                    ),
                    if (_markingAttendance)
                      const Padding(
                        padding: EdgeInsets.only(top: 12),
                        child: Center(child: CircularProgressIndicator()),
                      ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Stats card
            statsAsync.when(
              loading: () => const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ),
              error: (e, _) => const SizedBox.shrink(),
              data: (stats) => Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Statistics',
                          style: theme.textTheme.titleMedium),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _StatItem(
                            label: 'Total',
                            value: '${stats.totalParticipants}',
                            color: theme.colorScheme.primary,
                          ),
                          _StatItem(
                            label: 'On Time',
                            value: '${stats.onTime}',
                            color: AppThemeTokens.success,
                          ),
                          _StatItem(
                            label: 'Late',
                            value: '${stats.late}',
                            color: AppThemeTokens.warning,
                          ),
                          _StatItem(
                            label: 'No Show',
                            value: '${stats.noShow}',
                            color: theme.colorScheme.error,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: stats.attendanceRate / 100,
                          minHeight: 8,
                          backgroundColor:
                              theme.colorScheme.surfaceContainerHighest,
                          color: AppThemeTokens.success,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Attendance rate: ${stats.attendanceRate.toStringAsFixed(1)}%',
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: AppThemeTokens.darkTextSecondary),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Attendance list
            Text('Attendance Records', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),

            attendanceAsync.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorDisplay(
                message: extractErrorMessage(e),
                onRetry: () =>
                    ref.invalidate(attendanceProvider(widget.eventId)),
              ),
              data: (records) {
                if (records.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      child: Text(
                        'No attendance records yet.',
                        style: theme.textTheme.bodyMedium
                            ?.copyWith(color: AppThemeTokens.darkTextSecondary),
                      ),
                    ),
                  );
                }
                return Column(
                  children: records.map((record) {
                    final isSelf = record.userId == currentUserId;
                    return ListTile(
                      leading: UserAvatar(
                        name: record.userName ?? 'Unknown',
                        imageUrl: record.userPicture,
                      ),
                      title: Text(record.userName ?? 'Unknown'),
                      subtitle: Text(
                        'Updated ${DateFormat('MMM d, h:mm a').format(record.updatedAt.toLocal())}',
                        style: theme.textTheme.bodySmall,
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _AttendanceChip(status: record.status),
                          if (isSelf)
                            IconButton(
                              icon: const Icon(Icons.delete_outline, size: 18),
                              tooltip: 'Remove',
                              onPressed: () =>
                                  _deleteAttendance(record.userId),
                            ),
                        ],
                      ),
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  const _StatItem({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: color,
                fontWeight: FontWeight.bold,
              ),
        ),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _AttendanceChip extends StatelessWidget {
  const _AttendanceChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final isOnTime = status == 'on_time' || status == 'on-time';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isOnTime
            ? AppThemeTokens.success.withValues(alpha: 0.15)
            : AppThemeTokens.warning.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        isOnTime ? 'On Time' : 'Late',
        style: TextStyle(
          fontSize: 12,
          color: isOnTime ? AppThemeTokens.success : AppThemeTokens.warning,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
