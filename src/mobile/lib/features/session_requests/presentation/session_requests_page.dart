import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/models/session_request_model.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../state/session_requests_notifier.dart';

class SessionRequestsPage extends ConsumerStatefulWidget {
  const SessionRequestsPage({super.key, required this.groupId});
  final String groupId;

  @override
  ConsumerState<SessionRequestsPage> createState() =>
      _SessionRequestsPageState();
}

class _SessionRequestsPageState extends ConsumerState<SessionRequestsPage> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _sessionTypeCtrl = TextEditingController();
  DateTime? _startTime;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _sessionTypeCtrl.dispose();
    super.dispose();
  }

  UiStatusType _statusType(String status) {
    switch (status) {
      case 'approved':
        return UiStatusType.success;
      case 'pending':
        return UiStatusType.info;
      default:
        return UiStatusType.defaultStatus;
    }
  }

  Future<void> _showCreateDialog() async {
    _titleCtrl.clear();
    _descCtrl.clear();
    _sessionTypeCtrl.clear();
    _startTime = null;

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('New Session Request'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _titleCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Title *',
                    hintText: 'e.g. Weekend Football Match',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _descCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Description',
                    hintText: 'Briefly describe the session (optional)',
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _sessionTypeCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Session type *',
                    hintText: 'e.g. Training, Match, Scrimmage',
                  ),
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.calendar_today_outlined),
                  title: Text(
                    _startTime != null
                        ? DateFormat('MMM d, y').format(_startTime!)
                        : 'Select start date *',
                    style: _startTime == null
                        ? const TextStyle(
                            color: AppThemeTokens.darkTextSecondary)
                        : null,
                  ),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate:
                          DateTime.now().add(const Duration(days: 7)),
                      firstDate: DateTime.now(),
                      lastDate:
                          DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) {
                      setDialogState(() => _startTime = picked);
                    }
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () async {
                final title = _titleCtrl.text.trim();
                final sessionType = _sessionTypeCtrl.text.trim();
                if (title.isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Title is required')),
                  );
                  return;
                }
                if (sessionType.isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Session type is required')),
                  );
                  return;
                }
                if (_startTime == null) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Start date is required')),
                  );
                  return;
                }
                Navigator.of(ctx).pop();
                try {
                  await ref
                      .read(eventRequestsNotifierProvider(widget.groupId)
                          .notifier)
                      .create({
                    'groupId': widget.groupId,
                    'title': title,
                    'sessionType': sessionType,
                    'startTime': _startTime!.toIso8601String(),
                    if (_descCtrl.text.trim().isNotEmpty)
                      'description': _descCtrl.text.trim(),
                  });
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Session request created!')),
                    );
                  }
                } on Exception catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text(extractErrorMessage(e)),
                      backgroundColor:
                          Theme.of(context).colorScheme.error,
                    ));
                  }
                }
              },
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  void _showDetailDialog(SessionRequestModel request) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(request.title),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (request.description != null) ...[
                Text(request.description!),
                const SizedBox(height: 12),
              ],
              if (request.requestedDate != null) ...[
                Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined, size: 14),
                    const SizedBox(width: 6),
                    Text(DateFormat('MMM d, y')
                        .format(request.requestedDate!)),
                  ],
                ),
                const SizedBox(height: 8),
              ],
              if (request.sportType != null) ...[
                Row(
                  children: [
                    const Icon(Icons.sports_outlined, size: 14),
                    const SizedBox(width: 6),
                    Text(request.sportType!),
                  ],
                ),
                const SizedBox(height: 8),
              ],
              Text(
                'Votes: ${request.voteCount} / ${request.totalVotes}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text('Requested by: ${request.createdByName ?? 'Unknown'}'),
              const SizedBox(height: 4),
              Text('Created: ${DateFormat('MMM d, y').format(request.createdAt)}'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final requestsAsync =
        ref.watch(eventRequestsNotifierProvider(widget.groupId));
    final currentUserId =
        ref.watch(authNotifierProvider).user?.id;

    return Scaffold(
      appBar: AppBar(title: const Text('Session Requests')),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateDialog,
        tooltip: 'New Request',
        child: const Icon(Icons.add),
      ),
      body: requestsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: extractErrorMessage(e),
          onRetry: () => ref
              .read(eventRequestsNotifierProvider(widget.groupId).notifier)
              .reload(),
        ),
        data: (requests) => RefreshIndicator(
          onRefresh: () => ref
              .read(eventRequestsNotifierProvider(widget.groupId).notifier)
              .reload(),
          child: requests.isEmpty
              ? const UiEmptyState(
                  icon: Icons.event_note_outlined,
                  title: 'No Session Requests',
                  message:
                      'Be the first to suggest a session for your group.',
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                  itemCount: requests.length,
                  itemBuilder: (ctx, i) {
                    final req = requests[i];
                    final isOwner = req.createdById == currentUserId;
                    final isPending = req.status == 'pending';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _RequestCard(
                        request: req,
                        statusType: _statusType(req.status),
                        onTap: () => _showDetailDialog(req),
                        onUpvote: isPending
                            ? () async {
                                try {
                                  await ref
                                      .read(eventRequestsNotifierProvider(
                                              widget.groupId)
                                          .notifier)
                                      .vote(req.id, true);
                                } on Exception catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(SnackBar(
                                      content: Text(extractErrorMessage(e)),
                                      backgroundColor: Theme.of(context)
                                          .colorScheme
                                          .error,
                                    ));
                                  }
                                }
                              }
                            : null,
                        onFinalize: isOwner && isPending
                            ? () async {
                                try {
                                  await ref
                                      .read(eventRequestsNotifierProvider(
                                              widget.groupId)
                                          .notifier)
                                      .finalize(req.id);
                                } on Exception catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(SnackBar(
                                      content: Text(extractErrorMessage(e)),
                                      backgroundColor: Theme.of(context)
                                          .colorScheme
                                          .error,
                                    ));
                                  }
                                }
                              }
                            : null,
                        onCancel: isOwner && isPending
                            ? () async {
                                try {
                                  await ref
                                      .read(eventRequestsNotifierProvider(
                                              widget.groupId)
                                          .notifier)
                                      .cancel(req.id);
                                } on Exception catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(SnackBar(
                                      content: Text(extractErrorMessage(e)),
                                      backgroundColor: Theme.of(context)
                                          .colorScheme
                                          .error,
                                    ));
                                  }
                                }
                              }
                            : null,
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.request,
    required this.statusType,
    required this.onTap,
    this.onUpvote,
    this.onFinalize,
    this.onCancel,
  });

  final SessionRequestModel request;
  final UiStatusType statusType;
  final VoidCallback onTap;
  final VoidCallback? onUpvote;
  final VoidCallback? onFinalize;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    final hasActions =
        onUpvote != null || onFinalize != null || onCancel != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppThemeTokens.darkCard,
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.darkBorder),
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              request.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppThemeTokens.darkText,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                UiStatusBadge(
                  label: request.status,
                  status: statusType,
                  dot: true,
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppThemeTokens.darkCardElevated,
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(color: AppThemeTokens.darkBorder),
                  ),
                  child: Text(
                    '${request.voteCount} votes',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppThemeTokens.darkTextSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                if (request.requestedDate != null) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppThemeTokens.infoBg,
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.calendar_today_outlined,
                            size: 10, color: AppThemeTokens.info),
                        const SizedBox(width: 4),
                        Text(
                          DateFormat('MMM d')
                              .format(request.requestedDate!),
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppThemeTokens.info,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
            if (hasActions) ...[
              const SizedBox(height: 10),
              const Divider(height: 1, color: AppThemeTokens.darkBorder),
              const SizedBox(height: 10),
              Row(
                children: [
                  if (onUpvote != null)
                    _ActionButton(
                      icon: Icons.thumb_up_outlined,
                      label: 'Upvote',
                      color: AppThemeTokens.info,
                      onPressed: onUpvote!,
                    ),
                  if (onFinalize != null) ...[
                    const SizedBox(width: 8),
                    _ActionButton(
                      icon: Icons.check_circle_outline,
                      label: 'Finalize',
                      color: AppThemeTokens.success,
                      onPressed: onFinalize!,
                    ),
                  ],
                  if (onCancel != null) ...[
                    const SizedBox(width: 8),
                    _ActionButton(
                      icon: Icons.cancel_outlined,
                      label: 'Cancel',
                      color: AppThemeTokens.error,
                      onPressed: onCancel!,
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
