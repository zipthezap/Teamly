import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/tournament_repository_impl.dart';
import '../state/tournaments_notifier.dart';

/// Announcements management page.
///
/// Organizers can create, pin/unpin, and delete announcements.
/// All users can view announcements for tournaments they are part of.
class TournamentAnnouncementsPage extends ConsumerStatefulWidget {
  const TournamentAnnouncementsPage({
    super.key,
    required this.tournamentId,
    this.isAdmin = false,
  });

  final String tournamentId;
  final bool isAdmin;

  @override
  ConsumerState<TournamentAnnouncementsPage> createState() =>
      _TournamentAnnouncementsPageState();
}

class _TournamentAnnouncementsPageState
    extends ConsumerState<TournamentAnnouncementsPage> {
  void _refresh() {
    ref.invalidate(tournamentAnnouncementsProvider(widget.tournamentId));
  }

  Future<void> _createAnnouncement() async {
    final titleCtrl = TextEditingController();
    final bodyCtrl = TextEditingController();
    bool isPinned = false;

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: const Text('New Announcement'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(labelText: 'Title *'),
                textCapitalization: TextCapitalization.sentences,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: bodyCtrl,
                decoration: const InputDecoration(labelText: 'Body *'),
                maxLines: 4,
                textCapitalization: TextCapitalization.sentences,
              ),
              const SizedBox(height: 8),
              SwitchListTile.adaptive(
                value: isPinned,
                onChanged: (v) => setS(() => isPinned = v),
                title: const Text('Pin announcement'),
                subtitle:
                    const Text('Pinned announcements appear at the top'),
                contentPadding: EdgeInsets.zero,
              ),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            FilledButton(
                onPressed: () {
                  if (titleCtrl.text.trim().isEmpty ||
                      bodyCtrl.text.trim().isEmpty) return;
                  Navigator.pop(ctx, true);
                },
                child: const Text('Post')),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(tournamentRepositoryProvider).createAnnouncement(
            widget.tournamentId,
            title: titleCtrl.text.trim(),
            body: bodyCtrl.text.trim(),
            isPinned: isPinned,
          );
      _refresh();
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(extractErrorMessage(e)),
              backgroundColor: Theme.of(context).colorScheme.error),
        );
      }
    }
  }

  Future<void> _togglePin(TournamentAnnouncementModel ann) async {
    try {
      await ref.read(tournamentRepositoryProvider).updateAnnouncement(
            widget.tournamentId,
            ann.id,
            isPinned: !ann.isPinned,
          );
      _refresh();
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(extractErrorMessage(e))),
        );
      }
    }
  }

  Future<void> _delete(TournamentAnnouncementModel ann) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Announcement'),
        content: Text(
            'Are you sure you want to delete "${ann.title}"? This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref
          .read(tournamentRepositoryProvider)
          .deleteAnnouncement(widget.tournamentId, ann.id);
      _refresh();
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(extractErrorMessage(e))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final announcementsAsync =
        ref.watch(tournamentAnnouncementsProvider(widget.tournamentId));

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Announcements'),
        leading: BackButton(onPressed: () => context.pop()),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            tooltip: 'Refresh',
            onPressed: _refresh,
          ),
        ],
      ),
      floatingActionButton: widget.isAdmin
          ? FloatingActionButton.extended(
              onPressed: _createAnnouncement,
              icon: const Icon(Icons.add),
              label: const Text('New'),
            )
          : null,
      body: announcementsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(message: e.toString()),
        data: (announcements) {
          if (announcements.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.campaign_outlined,
                      size: 64,
                      color: AppThemeTokens.textMuted(context)),
                  const SizedBox(height: 16),
                  Text(
                    widget.isAdmin
                        ? 'No announcements yet.\nTap + to post one.'
                        : 'No announcements yet.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: AppThemeTokens.textSecondary(context)),
                  ),
                ],
              ),
            );
          }

          // Sort: pinned first, then newest
          final sorted = List<TournamentAnnouncementModel>.from(announcements)
            ..sort((a, b) {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return b.createdAt.compareTo(a.createdAt);
            });

          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: sorted.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) => _AnnouncementCard(
                announcement: sorted[i],
                isAdmin: widget.isAdmin,
                onTogglePin: _togglePin,
                onDelete: _delete,
              ),
            ),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Announcement card
// ---------------------------------------------------------------------------

class _AnnouncementCard extends StatelessWidget {
  const _AnnouncementCard({
    required this.announcement,
    required this.isAdmin,
    required this.onTogglePin,
    required this.onDelete,
  });

  final TournamentAnnouncementModel announcement;
  final bool isAdmin;
  final void Function(TournamentAnnouncementModel) onTogglePin;
  final void Function(TournamentAnnouncementModel) onDelete;

  @override
  Widget build(BuildContext context) {
    final a = announcement;
    final dateFmt = DateFormat('MMM d, yyyy · HH:mm');

    return UiCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (a.isPinned)
              Padding(
                padding: const EdgeInsets.only(right: 6, top: 2),
                child: Icon(Icons.push_pin_outlined,
                    size: 14, color: AppThemeTokens.primary500),
              ),
            Expanded(
              child: Text(
                a.title,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 14),
              ),
            ),
            if (isAdmin)
              PopupMenuButton<_AnnAction>(
                padding: EdgeInsets.zero,
                icon: Icon(Icons.more_vert_outlined,
                    size: 18,
                    color: AppThemeTokens.textSecondary(context)),
                itemBuilder: (ctx) => [
                  PopupMenuItem(
                    value: _AnnAction.pin,
                    child: Row(children: [
                      Icon(
                          a.isPinned
                              ? Icons.push_pin_outlined
                              : Icons.push_pin,
                          size: 16),
                      const SizedBox(width: 8),
                      Text(a.isPinned ? 'Unpin' : 'Pin'),
                    ]),
                  ),
                  PopupMenuItem(
                    value: _AnnAction.delete,
                    child: Row(children: [
                      Icon(Icons.delete_outline,
                          size: 16,
                          color: Theme.of(context).colorScheme.error),
                      const SizedBox(width: 8),
                      Text('Delete',
                          style: TextStyle(
                              color: Theme.of(context).colorScheme.error)),
                    ]),
                  ),
                ],
                onSelected: (action) {
                  if (action == _AnnAction.pin) onTogglePin(a);
                  if (action == _AnnAction.delete) onDelete(a);
                },
              ),
          ]),
          const SizedBox(height: 6),
          Text(a.body,
              style: TextStyle(
                  fontSize: 13,
                  color: AppThemeTokens.textSecondary(context))),
          const SizedBox(height: 8),
          Row(children: [
            Icon(Icons.person_outline,
                size: 12, color: AppThemeTokens.textMuted(context)),
            const SizedBox(width: 4),
            Text(a.authorName,
                style: TextStyle(
                    fontSize: 11,
                    color: AppThemeTokens.textMuted(context))),
            const Spacer(),
            Text(dateFmt.format(a.createdAt.toLocal()),
                style: TextStyle(
                    fontSize: 11,
                    color: AppThemeTokens.textMuted(context))),
          ]),
        ],
      ),
    );
  }
}

enum _AnnAction { pin, delete }
