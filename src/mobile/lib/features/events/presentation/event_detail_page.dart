import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/comment_model.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../features/comments/data/comment_repository_impl.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../data/event_repository_impl.dart';
import '../state/events_notifier.dart';
import 'attendance_page.dart';
import 'event_form_page.dart';
import 'event_invite_analytics_page.dart';
import 'participants_page.dart';

final _eventCommentsProvider =
    FutureProvider.family<List<CommentModel>, String>(
  (ref, eventId) =>
      ref.watch(commentRepositoryProvider).getEventComments(eventId),
);

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
  // Tracks the late status locally for the current session.
  // The backend doesn't expose "is late" directly on EventModel participants,
  // so we default to false and toggle in-session. The correct server state
  // is reflected after the user explicitly marks/unmarks late.
  bool _isMarkedLate = false;

  String _errorMessage(Exception e) {
    if (e is DioException) {
      final inner = e.error;
      if (inner is AppException) return inner.message;
      return e.message ?? 'Network error';
    }
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _toggleArchive(bool archived) async {
    try {
      final repo = ref.read(eventRepositoryProvider);
      if (archived) {
        await repo.unarchiveEvent(widget.eventId);
      } else {
        await repo.archiveEvent(widget.eventId);
      }
      ref.invalidate(eventDetailProvider(widget.eventId));
      ref.read(eventsNotifierProvider.notifier).load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(archived ? 'Event unarchived' : 'Event archived')),
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

  Future<void> _markLate(bool isLate) async {
    setState(() => _markingLate = true);
    try {
      final repo = ref.read(eventRepositoryProvider);
      if (isLate) {
        await repo.markLate(widget.eventId);
      } else {
        await repo.unmarkLate(widget.eventId);
      }
      setState(() => _isMarkedLate = isLate);
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

  Future<void> _deleteEvent(String title) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete event'),
        content: Text('Delete "$title"? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) {
      return;
    }

    try {
      await ref.read(eventRepositoryProvider).deleteEvent(widget.eventId);
      ref.read(eventsNotifierProvider.notifier).load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Event deleted.')),
        );
        context.go('/events');
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
          eventAsync.maybeWhen(
            data: (event) {
              final isCreator = event.creator.id == currentUserId;
              return PopupMenuButton<String>(
                onSelected: (action) {
                  switch (action) {
                    case 'edit':
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => EventFormPage(existingEvent: event),
                      ));
                      break;
                    case 'delete':
                      _deleteEvent(event.title);
                      break;
                    case 'archive':
                      _toggleArchive(event.archived ?? false);
                      break;
                    case 'participants':
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => ParticipantsPage(
                          eventId: widget.eventId,
                          eventTitle: event.title,
                        ),
                      ));
                      break;
                    case 'attendance':
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => AttendancePage(
                          eventId: widget.eventId,
                          eventTitle: event.title,
                        ),
                      ));
                      break;
                    case 'analytics':
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => EventInviteAnalyticsPage(
                          eventId: widget.eventId,
                          eventTitle: event.title,
                        ),
                      ));
                      break;
                    case 'refresh':
                      ref.invalidate(eventDetailProvider(widget.eventId));
                      break;
                  }
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(
                    value: 'participants',
                    child: ListTile(
                      leading: Icon(Icons.people_outline),
                      title: Text('Participants & Guests'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'attendance',
                    child: ListTile(
                      leading: Icon(Icons.how_to_reg_outlined),
                      title: Text('Attendance'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  if (isCreator) ...[
                    const PopupMenuItem(
                      value: 'edit',
                      child: ListTile(
                        leading: Icon(Icons.edit_outlined),
                        title: Text('Edit Event'),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'analytics',
                      child: ListTile(
                        leading: Icon(Icons.analytics_outlined),
                        title: Text('Invite Analytics'),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    PopupMenuItem(
                      value: 'archive',
                      child: ListTile(
                        leading: Icon(
                          event.archived ?? false
                              ? Icons.unarchive_outlined
                              : Icons.archive_outlined,
                        ),
                        title: Text(
                            event.archived ?? false ? 'Unarchive' : 'Archive'),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'delete',
                      child: ListTile(
                        leading: Icon(
                          Icons.delete_outline,
                          color: AppThemeTokens.error,
                        ),
                        title: Text(
                          'Delete Event',
                          style: TextStyle(color: AppThemeTokens.error),
                        ),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ],
                  const PopupMenuItem(
                    value: 'refresh',
                    child: ListTile(
                      leading: Icon(Icons.refresh),
                      title: Text('Refresh'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ],
              );
            },
            orElse: () => IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () =>
                  ref.invalidate(eventDetailProvider(widget.eventId)),
            ),
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
          final isParticipant =
              currentUserId != null && event.isParticipant(currentUserId);
          final confirmedCount = event.participantCount;
          final localStart = event.startTime.toLocal();
          final localEnd = event.endTime.toLocal();
          final isCreator = event.creator.id == currentUserId;
          final isPast = localEnd.isBefore(DateTime.now());
          final spotsRemaining = event.maxPlayers != null
              ? event.maxPlayers! - confirmedCount
              : null;

          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(eventDetailProvider(widget.eventId)),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                UiCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(event.title, style: theme.textTheme.headlineSmall),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (event.eventType != null)
                            _EventMetaChip(label: event.eventType!),
                          _EventMetaChip(
                            label: event.isPublic ? 'Public' : 'Private',
                            icon: event.isPublic
                                ? Icons.public_outlined
                                : Icons.lock_outline,
                          ),
                          _EventMetaChip(
                            label:
                                event.archived == true ? 'Archived' : 'Active',
                            icon: event.archived == true
                                ? Icons.archive_outlined
                                : Icons.check_circle_outline,
                          ),
                          _EventMetaChip(
                            label: event.maxPlayers != null
                                ? '$confirmedCount/${event.maxPlayers} players'
                                : '$confirmedCount participant${confirmedCount == 1 ? '' : 's'}',
                            icon: Icons.people_outline,
                          ),
                          if (isPast)
                            const _EventMetaChip(
                              label: 'Past event',
                              icon: Icons.history,
                            ),
                          if (!event.isFull && spotsRemaining != null)
                            _EventMetaChip(
                              label: '$spotsRemaining spots left',
                              icon: Icons.event_seat_outlined,
                            ),
                          if (event.isFull)
                            const _EventMetaChip(
                              label: 'Full',
                              icon: Icons.group_off_outlined,
                            ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _DetailRow(
                        icon: Icons.calendar_today_outlined,
                        label: DateFormat('EEEE, MMMM d, y').format(localStart),
                      ),
                      _DetailRow(
                        icon: Icons.access_time,
                        label:
                            '${DateFormat.jm().format(localStart)} – ${DateFormat.jm().format(localEnd)}',
                      ),
                      if (event.locationName != null || event.location != null)
                        _DetailRow(
                          icon: Icons.place_outlined,
                          label: event.locationName ?? event.location!,
                        ),
                      if (event.city != null || event.country != null)
                        _DetailRow(
                          icon: Icons.location_city_outlined,
                          label: [event.city, event.country]
                              .whereType<String>()
                              .join(', '),
                        ),
                      InkWell(
                        onTap: () => context.push('/groups/${event.group.id}'),
                        borderRadius:
                            BorderRadius.circular(AppThemeTokens.radiusMd),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              const Icon(Icons.group_outlined,
                                  size: 18,
                                  color: AppThemeTokens.darkTextSecondary),
                              const SizedBox(width: 10),
                              Expanded(child: Text(event.group.name)),
                              const Icon(Icons.chevron_right,
                                  color: AppThemeTokens.darkTextSecondary),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                UiCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Host', style: theme.textTheme.titleMedium),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          UserAvatar(
                            name: event.creator.name,
                            imageUrl: event.creator.profilePicture,
                            radius: 22,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(event.creator.name,
                                    style: theme.textTheme.titleSmall),
                                Text(
                                  event.creator.email,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: AppThemeTokens.darkTextSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                if (event.description != null &&
                    event.description!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  UiCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('About', style: theme.textTheme.titleMedium),
                        const SizedBox(height: 8),
                        Text(event.description!),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 20),

                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (isCreator)
                      FilledButton.icon(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => EventFormPage(existingEvent: event),
                          ),
                        ),
                        icon: const Icon(Icons.edit_outlined),
                        label: const Text('Edit'),
                      ),
                    OutlinedButton.icon(
                      onPressed: () =>
                          Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => ParticipantsPage(
                          eventId: widget.eventId,
                          eventTitle: event.title,
                        ),
                      )),
                      icon: const Icon(Icons.people_outline),
                      label: const Text('Participants'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () =>
                          Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => AttendancePage(
                          eventId: widget.eventId,
                          eventTitle: event.title,
                        ),
                      )),
                      icon: const Icon(Icons.how_to_reg_outlined),
                      label: const Text('Attendance'),
                    ),
                    if (event.creator.id == currentUserId)
                      OutlinedButton.icon(
                        onPressed: () =>
                            Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => EventInviteAnalyticsPage(
                            eventId: widget.eventId,
                            eventTitle: event.title,
                          ),
                        )),
                        icon: const Icon(Icons.analytics_outlined),
                        label: const Text('Analytics'),
                      ),
                  ],
                ),

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
                              label: Text(
                                  event.isFull ? 'Event Full' : 'Join Event'),
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
                      : _isMarkedLate
                          ? OutlinedButton.icon(
                              onPressed: () => _markLate(false),
                              icon: const Icon(Icons.check_circle_outline),
                              label: const Text('Remove late status'),
                            )
                          : OutlinedButton.icon(
                              onPressed: () => _markLate(true),
                              icon: const Icon(Icons.access_time),
                              label: const Text('Mark me as late'),
                            ),
                ],

                const SizedBox(height: 24),

                // Activity feed
                _ActivityFeedSection(eventId: widget.eventId),

                const SizedBox(height: 24),

                // Comments
                _CommentsSection(
                  eventId: widget.eventId,
                  currentUserId: currentUserId ?? '',
                ),
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
                    title:
                        Text(entry.summary, style: theme.textTheme.bodySmall),
                    trailing: Text(
                      _formatTime(entry.createdAt),
                      style: theme.textTheme.labelSmall
                          ?.copyWith(color: AppThemeTokens.darkTextSecondary),
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

// ---------------------------------------------------------------------------
// Comments section
// ---------------------------------------------------------------------------

class _CommentsSection extends ConsumerStatefulWidget {
  const _CommentsSection({required this.eventId, required this.currentUserId});
  final String eventId;
  final String currentUserId;

  @override
  ConsumerState<_CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends ConsumerState<_CommentsSection> {
  final _textCtrl = TextEditingController();
  bool _sending = false;
  String? _editingCommentId;
  final _editCtrl = TextEditingController();

  @override
  void dispose() {
    _textCtrl.dispose();
    _editCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendComment() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref
          .read(commentRepositoryProvider)
          .createComment(widget.eventId, text);
      _textCtrl.clear();
      ref.invalidate(_eventCommentsProvider(widget.eventId));
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _deleteComment(String commentId) async {
    try {
      await ref.read(commentRepositoryProvider).deleteComment(commentId);
      ref.invalidate(_eventCommentsProvider(widget.eventId));
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    }
  }

  Future<void> _submitEdit(String commentId) async {
    final text = _editCtrl.text.trim();
    if (text.isEmpty) return;
    try {
      await ref.read(commentRepositoryProvider).updateComment(commentId, text);
      setState(() => _editingCommentId = null);
      ref.invalidate(_eventCommentsProvider(widget.eventId));
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final commentsAsync = ref.watch(_eventCommentsProvider(widget.eventId));
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        commentsAsync.when(
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
          data: (comments) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text('Comments', style: theme.textTheme.titleMedium),
                  const SizedBox(width: 8),
                  if (comments.isNotEmpty)
                    Chip(
                      label: Text('${comments.length}'),
                      padding: EdgeInsets.zero,
                      labelPadding: const EdgeInsets.symmetric(horizontal: 6),
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
              const SizedBox(height: 8),
              if (comments.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text('No comments yet.',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: AppThemeTokens.darkTextSecondary)),
                )
              else
                ...comments.map((c) {
                  final isOwner = c.userId == widget.currentUserId;
                  final isEditing = _editingCommentId == c.id;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        UserAvatar(
                          name: c.userName,
                          imageUrl: c.userPicture,
                          radius: 16,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(c.userName,
                                      style: theme.textTheme.labelMedium
                                          ?.copyWith(
                                              fontWeight: FontWeight.bold)),
                                  const SizedBox(width: 6),
                                  Text(
                                    _formatTime(c.createdAt),
                                    style: theme.textTheme.labelSmall?.copyWith(
                                        color:
                                            AppThemeTokens.darkTextSecondary),
                                  ),
                                ],
                              ),
                              if (isEditing) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Expanded(
                                      child: TextField(
                                        controller: _editCtrl,
                                        decoration: const InputDecoration(
                                          isDense: true,
                                          border: OutlineInputBorder(),
                                        ),
                                        autofocus: true,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.check, size: 18),
                                      onPressed: () => _submitEdit(c.id),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.close, size: 18),
                                      onPressed: () => setState(
                                          () => _editingCommentId = null),
                                    ),
                                  ],
                                ),
                              ] else
                                Text(c.content,
                                    style: theme.textTheme.bodySmall),
                            ],
                          ),
                        ),
                        if (isOwner && !isEditing) ...[
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, size: 16),
                            visualDensity: VisualDensity.compact,
                            onPressed: () {
                              _editCtrl.text = c.content;
                              setState(() => _editingCommentId = c.id);
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline, size: 16),
                            visualDensity: VisualDensity.compact,
                            onPressed: () => _deleteComment(c.id),
                          ),
                        ],
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _textCtrl,
                decoration: InputDecoration(
                  hintText: 'Add a comment…',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24)),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                ),
                textCapitalization: TextCapitalization.sentences,
                minLines: 1,
                maxLines: 3,
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: _sending ? null : _sendComment,
              icon: _sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.send),
            ),
          ],
        ),
        const SizedBox(height: 24),
      ],
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
          Icon(icon, size: 18, color: AppThemeTokens.darkTextSecondary),
          const SizedBox(width: 8),
          Expanded(
              child:
                  Text(label, style: Theme.of(context).textTheme.bodyMedium)),
        ],
      ),
    );
  }
}

class _EventMetaChip extends StatelessWidget {
  const _EventMetaChip({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCardHover,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppThemeTokens.darkBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: AppThemeTokens.darkTextSecondary),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: AppThemeTokens.darkTextSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
