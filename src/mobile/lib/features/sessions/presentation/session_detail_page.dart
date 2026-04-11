import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/comment_model.dart';
import '../../../core/utils/maps_utils.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../features/comments/data/comment_repository_impl.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../data/session_repository_impl.dart';
import '../state/sessions_notifier.dart';
import 'attendance_page.dart';
import 'event_form_page.dart';
import 'event_invite_analytics_page.dart';
import 'participants_page.dart';

final _eventCommentsProvider =
    FutureProvider.family<List<CommentModel>, String>(
  (ref, eventId) =>
      ref.watch(commentRepositoryProvider).getEventComments(eventId),
);

class SessionDetailPage extends ConsumerStatefulWidget {
  const SessionDetailPage({super.key, required this.eventId});

  final String eventId;

  @override
  ConsumerState<SessionDetailPage> createState() => _SessionDetailPageState();
}

class _SessionDetailPageState extends ConsumerState<SessionDetailPage> {
  static const _kUnknown = 'Unknown';

  bool _actionLoading = false;
  bool _markingLate = false;
  // Tracks the late status locally for the current session.
  // The backend doesn't expose "is late" directly on SessionModel participants,
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
    final groupId =
        ref.read(eventDetailProvider(widget.eventId)).value?.group.id;
    try {
      final repo = ref.read(sessionRepositoryProvider);
      if (archived) {
        await repo.unarchiveEvent(widget.eventId);
      } else {
        await repo.archiveEvent(widget.eventId);
      }
      ref.invalidate(eventDetailProvider(widget.eventId));
      ref.read(sessionsNotifierProvider.notifier).reload();
      if (groupId != null) ref.invalidate(groupEventsProvider(groupId));
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
      final repo = ref.read(sessionRepositoryProvider);
      if (isLate) {
        await repo.markLate(widget.eventId);
      } else {
        await repo.unmarkLate(widget.eventId);
      }
      if (!mounted) return;
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
          .read(sessionRepositoryProvider)
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
    final groupId =
        ref.read(eventDetailProvider(widget.eventId)).value?.group.id;
    setState(() => _actionLoading = true);
    try {
      await ref.read(sessionRepositoryProvider).joinEvent(widget.eventId);
      ref.invalidate(eventDetailProvider(widget.eventId));
      ref.read(sessionsNotifierProvider.notifier).reload();
      if (groupId != null) ref.invalidate(groupEventsProvider(groupId));
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
    final groupId =
        ref.read(eventDetailProvider(widget.eventId)).value?.group.id;
    setState(() => _actionLoading = true);
    try {
      await ref.read(sessionRepositoryProvider).leaveEvent(widget.eventId);
      ref.invalidate(eventDetailProvider(widget.eventId));
      ref.read(sessionsNotifierProvider.notifier).reload();
      if (groupId != null) ref.invalidate(groupEventsProvider(groupId));
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
    final groupId =
        ref.read(eventDetailProvider(widget.eventId)).value?.group.id;
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
      await ref.read(sessionRepositoryProvider).deleteEvent(widget.eventId);
      ref.read(sessionsNotifierProvider.notifier).reload();
      if (groupId != null) ref.invalidate(groupEventsProvider(groupId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Event deleted.')),
        );
        context.go('/sessions');
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
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            height: 1,
            color: AppThemeTokens.border(context),
          ),
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
                        builder: (_) => SessionFormPage(existingEvent: event),
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
                        builder: (_) => SessionInviteAnalyticsPage(
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
                // ── Hero card ──────────────────────────────────────────────
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    gradient: AppThemeTokens.heroGrad(context),
                    borderRadius:
                        BorderRadius.circular(AppThemeTokens.radiusLg),
                    border: Border.all(color: AppThemeTokens.border(context)),
                  ),
                  child: ClipRRect(
                    borderRadius:
                        BorderRadius.circular(AppThemeTokens.radiusLg),
                    child: Stack(
                      children: [
                        Positioned(
                          top: -30,
                          right: -20,
                          child: Container(
                            width: 130,
                            height: 130,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppThemeTokens.primary500
                                  .withValues(alpha: 0.07),
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: -40,
                          left: -20,
                          child: Container(
                            width: 100,
                            height: 100,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppThemeTokens.primary500
                                  .withValues(alpha: 0.05),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                children: [
                                  if (event.sessionType != null)
                                    UiStatusBadge(
                                      label: sportTypeLabel(event.sessionType),
                                      status: UiStatusType.info,
                                      dot: true,
                                    ),
                                  UiStatusBadge(
                                    label: event.isPublic ? 'Public' : 'Private',
                                    status: UiStatusType.info,
                                    dot: true,
                                  ),
                                  if (event.archived == true)
                                    const UiStatusBadge(
                                      label: 'Archived',
                                      status: UiStatusType.warning,
                                      dot: true,
                                    ),
                                  if (isPast)
                                    const UiStatusBadge(
                                      label: 'Past',
                                      status: UiStatusType.defaultStatus,
                                      dot: true,
                                    ),
                                  if (event.isFull)
                                    const UiStatusBadge(
                                      label: 'Full',
                                      status: UiStatusType.error,
                                      dot: true,
                                    ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(
                                event.title,
                                style: TextStyle(
                                  color: AppThemeTokens.text(context),
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: -0.3,
                                ),
                              ),
                              const SizedBox(height: 4),
                              InkWell(
                                onTap: () =>
                                    context.push('/groups/${event.group.id}'),
                                borderRadius: BorderRadius.circular(
                                    AppThemeTokens.radiusSm),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.group_outlined,
                                        size: 13,
                                        color: AppThemeTokens.textSecondary(context)),
                                    const SizedBox(width: 4),
                                    Text(
                                      event.group.name,
                                      style: TextStyle(
                                        color: AppThemeTokens.textSecondary(context),
                                        fontSize: 13,
                                      ),
                                    ),
                                    const SizedBox(width: 2),
                                    Icon(Icons.chevron_right,
                                        size: 13,
                                        color: AppThemeTokens.textSecondary(context)),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 14),
                              Wrap(
                                spacing: 8,
                                runSpacing: 6,
                                children: [
                                  _HeroPill(
                                    icon: Icons.calendar_today_outlined,
                                    label: DateFormat('MMM d, y')
                                        .format(localStart),
                                  ),
                                  _HeroPill(
                                    icon: Icons.access_time,
                                    label:
                                        '${DateFormat.jm().format(localStart)} – ${DateFormat.jm().format(localEnd)}',
                                  ),
                                ],
                              ),
                              if (event.locationName != null ||
                                  event.location != null ||
                                  event.city != null ||
                                  event.country != null) ...[
                                const SizedBox(height: 8),
                                InkWell(
                                  onTap: () => openInMaps(
                                    context,
                                    [
                                      event.locationName ?? event.location,
                                      event.city,
                                      event.country,
                                    ].whereType<String>().join(', '),
                                  ),
                                  borderRadius: BorderRadius.circular(
                                      AppThemeTokens.radiusSm),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.place_outlined,
                                          size: 13,
                                          color: Color(0xFF2DD4BF)),
                                      const SizedBox(width: 5),
                                      Flexible(
                                        child: Text(
                                          [
                                            event.locationName ?? event.location,
                                            event.city,
                                            event.country,
                                          ].whereType<String>().join(', '),
                                          style: const TextStyle(
                                            color: Color(0xFF2DD4BF),
                                            fontSize: 13,
                                            decoration: TextDecoration.underline,
                                            decorationColor: Color(0xFF2DD4BF),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      const Icon(Icons.open_in_new,
                                          size: 11,
                                          color: Color(0xFF2DD4BF)),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 12),

                // ── Primary action: Join / Leave ───────────────────────────
                if (currentUserId != null && !isCreator) ...[
                  if (_actionLoading)
                    const Center(
                        child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: CircularProgressIndicator(),
                    ))
                  else if (isParticipant)
                    OutlinedButton.icon(
                      onPressed: _leave,
                      icon: const Icon(Icons.exit_to_app, size: 18),
                      label: const Text('Leave Event'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppThemeTokens.error,
                        side: BorderSide(
                            color: AppThemeTokens.error.withValues(alpha: 0.4)),
                        minimumSize: const Size(double.infinity, 44),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppThemeTokens.radiusMd),
                        ),
                      ),
                    )
                  else
                    UiPrimaryButton(
                      text: event.isFull ? 'Event Full' : 'Join Event',
                      icon: Icons.add,
                      onPressed: event.isFull ? null : _join,
                    ),
                  const SizedBox(height: 12),
                ],

                // ── Navigation actions ─────────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: _CompactActionCard(
                        icon: Icons.people_outline,
                        label: 'Participants',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ParticipantsPage(
                              eventId: widget.eventId,
                              eventTitle: event.title,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _CompactActionCard(
                        icon: Icons.how_to_reg_outlined,
                        label: 'Attendance',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => AttendancePage(
                              eventId: widget.eventId,
                              eventTitle: event.title,
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (isCreator) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: _CompactActionCard(
                          icon: Icons.analytics_outlined,
                          label: 'Analytics',
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => SessionInviteAnalyticsPage(
                                eventId: widget.eventId,
                                eventTitle: event.title,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),

                const SizedBox(height: 16),

                // ── Event details card ─────────────────────────────────────
                Container(
                  decoration: BoxDecoration(
                    color: AppThemeTokens.card(context),
                    borderRadius:
                        BorderRadius.circular(AppThemeTokens.radiusMd),
                    border: Border.all(color: AppThemeTokens.border(context)),
                  ),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      UiInfoRow(
                        icon: Icons.calendar_today_outlined,
                        label: DateFormat('EEEE, MMMM d, y').format(localStart),
                        iconColor: AppThemeTokens.primary400,
                      ),
                      UiInfoRow(
                        icon: Icons.access_time,
                        label:
                            '${DateFormat.jm().format(localStart)} – ${DateFormat.jm().format(localEnd)}',
                        iconColor: AppThemeTokens.primary400,
                      ),
                      if (event.locationName != null || event.location != null || event.city != null || event.country != null)
                        UiInfoRow(
                          icon: Icons.place_outlined,
                          label: [
                            event.locationName ?? event.location,
                            event.city,
                            event.country,
                          ].whereType<String>().join(', '),
                          iconColor: const Color(0xFF2DD4BF),
                          onTap: () => openInMaps(
                            context,
                            [
                              event.locationName ?? event.location,
                              event.city,
                              event.country,
                            ].whereType<String>().join(', '),
                          ),
                        ),
                      UiInfoRow(
                        icon: Icons.group_outlined,
                        label: event.group.name,
                        iconColor: const Color(0xFFA78BFA),
                      ),
                      UiInfoRow(
                        icon: Icons.people_outline,
                        label: event.maxPlayers != null
                            ? '$confirmedCount/${event.maxPlayers} participants'
                            : '$confirmedCount participant${confirmedCount == 1 ? '' : 's'}',
                        iconColor: AppThemeTokens.success,
                      ),
                      if (!event.isFull && spotsRemaining != null)
                        UiInfoRow(
                          icon: Icons.event_seat_outlined,
                          label: '$spotsRemaining spot${spotsRemaining == 1 ? '' : 's'} remaining',
                          iconColor: AppThemeTokens.warning,
                        ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // ── Host card ──────────────────────────────────────────────
                Container(
                  decoration: BoxDecoration(
                    color: AppThemeTokens.card(context),
                    borderRadius:
                        BorderRadius.circular(AppThemeTokens.radiusMd),
                    border: Border.all(color: AppThemeTokens.border(context)),
                  ),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const UiSectionTitle('Host'),
                      const SizedBox(height: 12),
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
                                    color: AppThemeTokens.textSecondary(context),
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
                  Container(
                    decoration: BoxDecoration(
                      color: AppThemeTokens.card(context),
                      borderRadius:
                          BorderRadius.circular(AppThemeTokens.radiusMd),
                      border: Border.all(color: AppThemeTokens.border(context)),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const UiSectionTitle('About'),
                        const SizedBox(height: 10),
                        Text(
                          event.description!,
                          style: TextStyle(
                            color: AppThemeTokens.textSecondary(context),
                            fontSize: 14,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 20),

                // ── Mark late toggle (participants only) ───────────────────
                if (isParticipant)
                  Container(
                    decoration: BoxDecoration(
                      color: AppThemeTokens.card(context),
                      borderRadius:
                          BorderRadius.circular(AppThemeTokens.radiusMd),
                      border: Border.all(color: AppThemeTokens.border(context)),
                    ),
                    child: ListTile(
                      dense: true,
                      leading: Icon(Icons.access_time,
                          size: 18,
                          color: AppThemeTokens.textSecondary(context)),
                      title: Text(
                        'Mark me as late',
                        style: TextStyle(
                          fontSize: 14,
                          color: AppThemeTokens.text(context),
                        ),
                      ),
                      trailing: _markingLate
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Switch.adaptive(
                              value: _isMarkedLate,
                              onChanged: _markLate,
                              activeColor: AppThemeTokens.warning,
                            ),
                    ),
                  ),

                const SizedBox(height: 20),

                // ── Participants section ───────────────────────────────────
                if (event.participants.isNotEmpty ||
                    event.guestParticipants.isNotEmpty) ...[
                  const UiSectionTitle('Participants'),
                  const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: AppThemeTokens.card(context),
                      borderRadius:
                          BorderRadius.circular(AppThemeTokens.radiusMd),
                      border: Border.all(color: AppThemeTokens.border(context)),
                    ),
                    child: Column(
                      children: [
                        ...event.participants
                            .where((p) => p.status != 'cancelled')
                            .map((p) => _CompactParticipantRow(
                                  name: p.name ?? _kUnknown,
                                  imageUrl: p.profilePicture,
                                  isWaitlisted: p.status == 'waitlisted',
                                  isGuest: false,
                                )),
                        ...event.guestParticipants
                            .where((g) => g.status != 'cancelled')
                            .map((g) => _CompactParticipantRow(
                                  name: g.name,
                                  isWaitlisted: g.status == 'waitlisted',
                                  isGuest: true,
                                )),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Activity feed ──────────────────────────────────────────
                _ActivityFeedSection(eventId: widget.eventId),

                const SizedBox(height: 24),

                // ── Comments ───────────────────────────────────────────────
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
// Compact action card (Participants / Attendance / Analytics)
// ---------------------------------------------------------------------------

class _CompactActionCard extends StatelessWidget {
  const _CompactActionCard({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: AppThemeTokens.card(context),
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(color: AppThemeTokens.border(context)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 20, color: AppThemeTokens.primary400),
              const SizedBox(height: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppThemeTokens.textSecondary(context),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Compact participant row
// ---------------------------------------------------------------------------

class _CompactParticipantRow extends StatelessWidget {
  const _CompactParticipantRow({
    required this.name,
    this.imageUrl,
    required this.isWaitlisted,
    required this.isGuest,
  });

  final String name;
  final String? imageUrl;
  final bool isWaitlisted;
  final bool isGuest;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      child: Row(
        children: [
          UserAvatar(name: name, imageUrl: imageUrl, radius: 14),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              name,
              style: TextStyle(
                color: AppThemeTokens.text(context),
                fontSize: 13,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (isGuest)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppThemeTokens.info.withValues(alpha: 0.15),
                borderRadius:
                    BorderRadius.circular(AppThemeTokens.radiusSm),
              ),
              child: const Text(
                'Guest',
                style: TextStyle(
                  color: AppThemeTokens.info,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          if (isWaitlisted) ...[
            const SizedBox(width: 4),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppThemeTokens.warning.withValues(alpha: 0.15),
                borderRadius:
                    BorderRadius.circular(AppThemeTokens.radiusSm),
              ),
              child: const Text(
                'Waitlisted',
                style: TextStyle(
                  color: AppThemeTokens.warning,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Activity feed section
// ---------------------------------------------------------------------------

class _ActivityFeedSection extends ConsumerStatefulWidget {
  const _ActivityFeedSection({required this.eventId});
  final String eventId;

  static const _maxEntries = 20;

  @override
  ConsumerState<_ActivityFeedSection> createState() =>
      _ActivityFeedSectionState();
}

class _ActivityFeedSectionState extends ConsumerState<_ActivityFeedSection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final feedAsync = ref.watch(activityFeedProvider(widget.eventId));

    return feedAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (entries) {
        if (entries.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            OutlinedButton.icon(
              onPressed: () => setState(() => _expanded = !_expanded),
              icon: Icon(
                _expanded ? Icons.expand_less : Icons.history_outlined,
                size: 18,
              ),
              label: Text('Activity (${entries.length})'),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: AppThemeTokens.border(context)),
                foregroundColor: AppThemeTokens.textSecondary(context),
                minimumSize: const Size(double.infinity, 44),
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(AppThemeTokens.radiusMd),
                ),
              ),
            ),
            if (_expanded) ...[
              const SizedBox(height: 10),
              ...entries.take(_ActivityFeedSection._maxEntries).map(
                    (entry) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppThemeTokens.card(context),
                        borderRadius:
                            BorderRadius.circular(AppThemeTokens.radiusMd),
                        border: Border.all(color: AppThemeTokens.border(context)),
                      ),
                      child: Row(
                        children: [
                          entry.userPicture != null || entry.userName != null
                              ? UserAvatar(
                                  name: entry.userName ?? '?',
                                  imageUrl: entry.userPicture,
                                  radius: 16,
                                )
                              : Container(
                                  width: 32,
                                  height: 32,
                                  decoration: BoxDecoration(
                                    color: AppThemeTokens.cardElevated(context),
                                    borderRadius: BorderRadius.circular(
                                        AppThemeTokens.radiusSm),
                                  ),
                                  child: Icon(Icons.info_outline,
                                      size: 14,
                                      color: AppThemeTokens.textSecondary(context)),
                                ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              entry.summary,
                              style: TextStyle(
                                color: AppThemeTokens.textSecondary(context),
                                fontSize: 13,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _formatTime(entry.createdAt),
                            style: TextStyle(
                              color: AppThemeTokens.textMuted(context),
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
            ],
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
      if (!mounted) return;
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        commentsAsync.when(
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
          data: (comments) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              UiSectionTitle(
                'Comments',
                trailing: comments.isNotEmpty
                    ? Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppThemeTokens.primaryGlow,
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          '${comments.length}',
                          style: const TextStyle(
                            color: AppThemeTokens.primary400,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      )
                    : null,
              ),
              const SizedBox(height: 10),
              if (comments.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'No comments yet.',
                    style: TextStyle(
                      color: AppThemeTokens.textSecondary(context),
                      fontSize: 13,
                    ),
                  ),
                )
              else
                ...comments.map((c) {
                  final isOwner = c.userId == widget.currentUserId;
                  final isEditing = _editingCommentId == c.id;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppThemeTokens.card(context),
                      borderRadius:
                          BorderRadius.circular(AppThemeTokens.radiusMd),
                      border: Border.all(color: AppThemeTokens.border(context)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        UserAvatar(
                          name: c.userName,
                          imageUrl: c.userPicture,
                          radius: 16,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    c.userName,
                                    style: TextStyle(
                                      color: AppThemeTokens.text(context),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    _formatTime(c.createdAt),
                                    style: TextStyle(
                                      color: AppThemeTokens.textMuted(context),
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                              if (isEditing) ...[
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    Expanded(
                                      child: TextField(
                                        controller: _editCtrl,
                                        decoration: InputDecoration(
                                          isDense: true,
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(
                                                AppThemeTokens.radiusSm),
                                            borderSide: BorderSide(
                                                color: AppThemeTokens.border(context)),
                                          ),
                                          contentPadding:
                                              const EdgeInsets.symmetric(
                                                  horizontal: 10, vertical: 8),
                                        ),
                                        autofocus: true,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.check,
                                          size: 18,
                                          color: AppThemeTokens.success),
                                      onPressed: () => _submitEdit(c.id),
                                    ),
                                    IconButton(
                                      icon: Icon(Icons.close,
                                          size: 18,
                                          color: AppThemeTokens.textSecondary(context)),
                                      onPressed: () => setState(
                                          () => _editingCommentId = null),
                                    ),
                                  ],
                                ),
                              ] else ...[
                                const SizedBox(height: 4),
                                Text(
                                  c.content,
                                  style: TextStyle(
                                    color: AppThemeTokens.textSecondary(context),
                                    fontSize: 13,
                                    height: 1.4,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        if (isOwner && !isEditing) ...[
                          IconButton(
                            icon: Icon(Icons.edit_outlined,
                                size: 15,
                                color: AppThemeTokens.textSecondary(context)),
                            visualDensity: VisualDensity.compact,
                            onPressed: () {
                              _editCtrl.text = c.content;
                              setState(() => _editingCommentId = c.id);
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline,
                                size: 15, color: AppThemeTokens.error),
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
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _textCtrl,
                decoration: InputDecoration(
                  hintText: 'Add a comment…',
                  hintStyle: TextStyle(
                      color: AppThemeTokens.textMuted(context), fontSize: 13),
                  filled: true,
                  fillColor: AppThemeTokens.cardElevated(context),
                  border: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(AppThemeTokens.radiusMd),
                    borderSide:
                        BorderSide(color: AppThemeTokens.border(context)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(AppThemeTokens.radiusMd),
                    borderSide:
                        BorderSide(color: AppThemeTokens.border(context)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(AppThemeTokens.radiusMd),
                    borderSide: const BorderSide(
                        color: AppThemeTokens.primary400, width: 1.5),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
                style: TextStyle(
                    color: AppThemeTokens.text(context), fontSize: 13),
                textCapitalization: TextCapitalization.sentences,
                minLines: 1,
                maxLines: 3,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              decoration: BoxDecoration(
                gradient: _sending
                    ? null
                    : AppThemeTokens.primaryGradient,
                color: _sending ? AppThemeTokens.cardElevated(context) : null,
                borderRadius:
                    BorderRadius.circular(AppThemeTokens.radiusMd),
              ),
              child: IconButton(
                onPressed: _sending ? null : _sendComment,
                icon: _sending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppThemeTokens.primary400))
                    : const Icon(Icons.send, color: Colors.white, size: 18),
              ),
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

/// A small pill-shaped chip used in the hero card for date/time display.
class _HeroPill extends StatelessWidget {
  const _HeroPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppThemeTokens.primary500.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
        border: Border.all(
            color: AppThemeTokens.primary500.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppThemeTokens.primary400),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: AppThemeTokens.primary400,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
