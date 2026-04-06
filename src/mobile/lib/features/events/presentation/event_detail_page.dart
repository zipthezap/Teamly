import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/event_model.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../data/event_repository_impl.dart';
import '../state/events_notifier.dart';

class EventDetailPage extends ConsumerStatefulWidget {
  const EventDetailPage({super.key, required this.eventId});

  final String eventId;

  @override
  ConsumerState<EventDetailPage> createState() => _EventDetailPageState();
}

class _EventDetailPageState extends ConsumerState<EventDetailPage> {
  static const _kUnknown = 'Unknown';

  bool _actionLoading = false;
  bool _markingLate = false;

  String _errorMessage(Exception e) {
    if (e is DioException) {
      final inner = e.error;
      if (inner is AppException) return inner.message;
      return e.message ?? 'Network error';
    }
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _markLate(bool isLate) async {
    setState(() => _markingLate = true);
    try {
      final repo = ref.read(eventRepositoryProvider);
      if (isLate) {
        await repo.markLate(widget.eventId);
      } else {
        await repo.unmarkLate(widget.eventId);
      }
      ref.invalidate(eventDetailProvider(widget.eventId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(isLate ? 'Marked as late' : 'Removed late status')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(_errorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error));
      }
    } finally {
      if (mounted) setState(() => _markingLate = false);
    }
  }

  Future<void> _copyInviteLink() async {
    try {
      final token = await ref
          .read(eventRepositoryProvider)
          .generateInviteToken(widget.eventId);
      final link = 'teamly://events/invite/$token';
      await Clipboard.setData(ClipboardData(text: link));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invite link copied!')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(_errorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error));
      }
    }
  }

  Future<void> _join() async {
    setState(() => _actionLoading = true);
    try {
      await ref.read(eventRepositoryProvider).joinEvent(widget.eventId);
      ref.invalidate(eventDetailProvider(widget.eventId));
      ref.read(eventsNotifierProvider.notifier).load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Joined event!')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_errorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  Future<void> _leave() async {
    setState(() => _actionLoading = true);
    try {
      await ref.read(eventRepositoryProvider).leaveEvent(widget.eventId);
      ref.invalidate(eventDetailProvider(widget.eventId));
      ref.read(eventsNotifierProvider.notifier).load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Left event.')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_errorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final eventAsync = ref.watch(eventDetailProvider(widget.eventId));
    final authState = ref.watch(authNotifierProvider);
    final currentUserId = authState.user?.id;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: eventAsync.maybeWhen(
          data: (e) => Text(e.title),
          orElse: () => const Text('Event'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.link),
            tooltip: 'Copy invite link',
            onPressed: _copyInviteLink,
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(eventDetailProvider(widget.eventId)),
          ),
        ],
      ),
      body: eventAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref.invalidate(eventDetailProvider(widget.eventId)),
        ),
        data: (event) {
          final isParticipant = currentUserId != null && event.isParticipant(currentUserId);
          final confirmedCount = event.participantCount;

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(eventDetailProvider(widget.eventId)),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Title & type
                Text(event.title, style: theme.textTheme.headlineSmall),
                const SizedBox(height: 8),
                if (event.eventType != null)
                  Chip(label: Text(event.eventType!)),

                const SizedBox(height: 16),

                // Date & time
                _DetailRow(
                  icon: Icons.calendar_today_outlined,
                  label: DateFormat('EEEE, MMMM d, y').format(event.startTime.toLocal()),
                ),
                _DetailRow(
                  icon: Icons.access_time,
                  label:
                      '${DateFormat.jm().format(event.startTime.toLocal())} – ${DateFormat.jm().format(event.endTime.toLocal())}',
                ),

                // Location
                if (event.locationName != null || event.location != null)
                  _DetailRow(
                    icon: Icons.place_outlined,
                    label: event.locationName ?? event.location!,
                  ),
                if (event.city != null)
                  _DetailRow(icon: Icons.location_city_outlined, label: event.city!),

                // Group
                _DetailRow(icon: Icons.group_outlined, label: event.group.name),

                // Participants count
                _DetailRow(
                  icon: Icons.people_outline,
                  label: event.maxPlayers != null
                      ? '$confirmedCount / ${event.maxPlayers} players'
                      : '$confirmedCount participant${confirmedCount == 1 ? '' : 's'}',
                ),

                if (event.description != null && event.description!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('About', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 6),
                  Text(event.description!),
                ],

                const SizedBox(height: 20),

                // Join / Leave button
                if (currentUserId != null)
                  _actionLoading
                      ? const Center(child: CircularProgressIndicator())
                      : isParticipant
                          ? OutlinedButton.icon(
                              onPressed: _leave,
                              icon: const Icon(Icons.exit_to_app),
                              label: const Text('Leave Event'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: theme.colorScheme.error,
                              ),
                            )
                          : FilledButton.icon(
                              onPressed: event.isFull ? null : _join,
                              icon: const Icon(Icons.add),
                              label: Text(event.isFull ? 'Event Full' : 'Join Event'),
                            ),

                const SizedBox(height: 24),

                // Participants list
                if (event.participants.isNotEmpty) ...[
                  Text('Participants', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  ...event.participants
                      .where((p) => p.status != 'cancelled')
                      .map(
                        (p) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: UserAvatar(
                            name: p.name ?? _kUnknown,
                            imageUrl: p.profilePicture,
                          ),
                          title: Text(p.name ?? _kUnknown),
                          trailing: p.status == 'waitlisted'
                              ? const Chip(label: Text('Waitlisted'))
                              : null,
                        ),
                      ),
                ],

                // Mark late button (only for participants)
                if (isParticipant) ...[
                  const SizedBox(height: 16),
                  _markingLate
                      ? const Center(child: CircularProgressIndicator())
                      : OutlinedButton.icon(
                          onPressed: () => _markLate(true),
                          icon: const Icon(Icons.access_time),
                          label: const Text('Mark me as late'),
                        ),
                ],

                const SizedBox(height: 24),

                // Activity feed
                _ActivityFeedSection(eventId: widget.eventId),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Activity feed section
// ---------------------------------------------------------------------------

class _ActivityFeedSection extends ConsumerWidget {
  const _ActivityFeedSection({required this.eventId});
  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedAsync = ref.watch(activityFeedProvider(eventId));
    final theme = Theme.of(context);

    return feedAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (entries) {
        if (entries.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Activity', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            ...entries.take(10).map(
              (entry) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: entry.userPicture != null || entry.userName != null
                    ? UserAvatar(
                        name: entry.userName ?? '?',
                        imageUrl: entry.userPicture,
                        radius: 16,
                      )
                    : CircleAvatar(
                        radius: 16,
                        backgroundColor:
                            theme.colorScheme.surfaceContainerHighest,
                        child: const Icon(Icons.info_outline, size: 14),
                      ),
                title: Text(entry.summary,
                    style: theme.textTheme.bodySmall),
                trailing: Text(
                  _formatTime(entry.createdAt),
                  style: theme.textTheme.labelSmall
                      ?.copyWith(color: Colors.grey),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt.toLocal());
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return DateFormat.MMMd().format(dt.toLocal());
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
        ],
      ),
    );
  }
}
