import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/models/event_request_model.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../state/event_requests_notifier.dart';

class EventRequestsPage extends ConsumerStatefulWidget {
  const EventRequestsPage({super.key, required this.groupId});
  final String groupId;

  @override
  ConsumerState<EventRequestsPage> createState() =>
      _EventRequestsPageState();
}

class _EventRequestsPageState extends ConsumerState<EventRequestsPage> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _sportCtrl = TextEditingController();
  DateTime? _requestedDate;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _sportCtrl.dispose();
    super.dispose();
  }

  String _extractMsg(Exception e) =>
      e.toString().replaceFirst('Exception: ', '');

  Color _statusColor(String status, BuildContext context) {
    switch (status) {
      case 'approved':
        return Colors.green;
      case 'cancelled':
        return Colors.grey;
      default:
        return Theme.of(context).colorScheme.primary;
    }
  }

  Future<void> _showCreateDialog() async {
    _titleCtrl.clear();
    _descCtrl.clear();
    _sportCtrl.clear();
    _requestedDate = null;

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('New Event Request'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _titleCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Title *',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _descCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Description (optional)',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _sportCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Sport type (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.calendar_today_outlined),
                  title: Text(
                    _requestedDate != null
                        ? DateFormat('MMM d, y')
                            .format(_requestedDate!)
                        : 'Select preferred date (optional)',
                    style: _requestedDate == null
                        ? const TextStyle(color: Colors.grey)
                        : null,
                  ),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: DateTime.now()
                          .add(const Duration(days: 7)),
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now()
                          .add(const Duration(days: 365)),
                    );
                    if (picked != null) {
                      setDialogState(() => _requestedDate = picked);
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
                if (title.isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Title is required')),
                  );
                  return;
                }
                Navigator.of(ctx).pop();
                try {
                  await ref
                      .read(eventRequestsNotifierProvider(
                              widget.groupId)
                          .notifier)
                      .create({
                    'groupId': widget.groupId,
                    'title': title,
                    if (_descCtrl.text.trim().isNotEmpty)
                      'description': _descCtrl.text.trim(),
                    if (_sportCtrl.text.trim().isNotEmpty)
                      'sportType': _sportCtrl.text.trim(),
                    if (_requestedDate != null)
                      'requestedDate':
                          _requestedDate!.toIso8601String(),
                  }, widget.groupId);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Event request created!')),
                    );
                  }
                } on Exception catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text(_extractMsg(e)),
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

  void _showDetailDialog(EventRequestModel request) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(request.title as String),
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
              Text(
                  'Created: ${DateFormat('MMM d, y').format(request.createdAt)}'),
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
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Event Requests')),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateDialog,
        tooltip: 'New request',
        child: const Icon(Icons.add),
      ),
      body: requestsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref
              .read(eventRequestsNotifierProvider(widget.groupId).notifier)
              .load(widget.groupId),
        ),
        data: (requests) => RefreshIndicator(
          onRefresh: () => ref
              .read(eventRequestsNotifierProvider(widget.groupId).notifier)
              .load(widget.groupId),
          child: requests.isEmpty
              ? const Center(
                  child: Text('No event requests yet.',
                      style: TextStyle(color: Colors.grey)),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(8, 8, 8, 80),
                  itemCount: requests.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (ctx, i) {
                    final req = requests[i];
                    final isOwner = req.createdById == currentUserId;
                    final isPending = req.status == 'pending';
                    return ListTile(
                      onTap: () => _showDetailDialog(req),
                      title: Text(req.title,
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: _statusColor(req.status, context)
                                  .withOpacity(0.15),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              req.status,
                              style: TextStyle(
                                fontSize: 11,
                                color: _statusColor(req.status, context),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${req.voteCount} votes',
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: Colors.grey),
                          ),
                        ],
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (isPending)
                            IconButton(
                              icon: const Icon(Icons.thumb_up_outlined),
                              tooltip: 'Upvote',
                              onPressed: () async {
                                try {
                                  await ref
                                      .read(eventRequestsNotifierProvider(
                                              widget.groupId)
                                          .notifier)
                                      .vote(req.id, true,
                                          widget.groupId);
                                } on Exception catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(SnackBar(
                                      content: Text(_extractMsg(e)),
                                      backgroundColor: theme
                                          .colorScheme.error,
                                    ));
                                  }
                                }
                              },
                            ),
                          if (isOwner && isPending) ...[
                            IconButton(
                              icon: const Icon(Icons.check_circle_outline),
                              tooltip: 'Finalize',
                              onPressed: () async {
                                try {
                                  await ref
                                      .read(eventRequestsNotifierProvider(
                                              widget.groupId)
                                          .notifier)
                                      .finalize(req.id, widget.groupId);
                                } on Exception catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(SnackBar(
                                      content: Text(_extractMsg(e)),
                                      backgroundColor: theme
                                          .colorScheme.error,
                                    ));
                                  }
                                }
                              },
                            ),
                            IconButton(
                              icon: const Icon(Icons.cancel_outlined),
                              tooltip: 'Cancel request',
                              onPressed: () async {
                                try {
                                  await ref
                                      .read(eventRequestsNotifierProvider(
                                              widget.groupId)
                                          .notifier)
                                      .cancel(req.id, widget.groupId);
                                } on Exception catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(SnackBar(
                                      content: Text(_extractMsg(e)),
                                      backgroundColor: theme
                                          .colorScheme.error,
                                    ));
                                  }
                                }
                              },
                            ),
                          ],
                        ],
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
