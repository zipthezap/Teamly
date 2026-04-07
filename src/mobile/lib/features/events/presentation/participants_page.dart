import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/extended_models.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../state/events_notifier.dart';

class ParticipantsPage extends ConsumerStatefulWidget {
  const ParticipantsPage({super.key, required this.eventId, this.eventTitle});

  final String eventId;
  final String? eventTitle;

  @override
  ConsumerState<ParticipantsPage> createState() => _ParticipantsPageState();
}

class _ParticipantsPageState extends ConsumerState<ParticipantsPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.eventTitle != null
            ? 'Participants – ${widget.eventTitle}'
            : 'Participants'),
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: const [
            Tab(text: 'Members'),
            Tab(text: 'Guests'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          _MembersTab(eventId: widget.eventId),
          _GuestsTab(eventId: widget.eventId),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Members tab
// ---------------------------------------------------------------------------

class _MembersTab extends ConsumerStatefulWidget {
  const _MembersTab({required this.eventId});
  final String eventId;

  @override
  ConsumerState<_MembersTab> createState() => _MembersTabState();
}

class _MembersTabState extends ConsumerState<_MembersTab> {
  String? _statusFilter;

  static const _statuses = ['all', 'confirmed', 'pending', 'declined', 'invited'];

  @override
  Widget build(BuildContext context) {
    final participantsAsync =
        ref.watch(eventParticipantsProvider(widget.eventId));
    final theme = Theme.of(context);

    return participantsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorDisplay(
        message: e.toString(),
        onRetry: () =>
            ref.invalidate(eventParticipantsProvider(widget.eventId)),
      ),
      data: (result) {
        final (participants, summary) = result;
        final filtered = _statusFilter == null || _statusFilter == 'all'
            ? participants
            : participants
                .where((p) => p.status == _statusFilter)
                .toList();

        return Column(
          children: [
            // Summary chips
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _SummaryChip(
                        label: 'All',
                        count: summary.total,
                        selected: _statusFilter == null || _statusFilter == 'all',
                        onTap: () =>
                            setState(() => _statusFilter = 'all')),
                    const SizedBox(width: 8),
                    _SummaryChip(
                        label: 'Confirmed',
                        count: summary.confirmed,
                        color: AppThemeTokens.success,
                        selected: _statusFilter == 'confirmed',
                        onTap: () =>
                            setState(() => _statusFilter = 'confirmed')),
                    const SizedBox(width: 8),
                    _SummaryChip(
                        label: 'Pending',
                        count: summary.pending,
                        color: AppThemeTokens.warning,
                        selected: _statusFilter == 'pending',
                        onTap: () =>
                            setState(() => _statusFilter = 'pending')),
                    const SizedBox(width: 8),
                    _SummaryChip(
                        label: 'Declined',
                        count: summary.declined,
                        color: AppThemeTokens.error,
                        selected: _statusFilter == 'declined',
                        onTap: () =>
                            setState(() => _statusFilter = 'declined')),
                    const SizedBox(width: 8),
                    _SummaryChip(
                        label: 'Invited',
                        count: summary.invited,
                        selected: _statusFilter == 'invited',
                        onTap: () =>
                            setState(() => _statusFilter = 'invited')),
                  ],
                ),
              ),
            ),
            const Divider(),
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text('No participants.',
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(color: AppThemeTokens.darkTextSecondary)))
                  : RefreshIndicator(
                      onRefresh: () async => ref
                          .invalidate(eventParticipantsProvider(widget.eventId)),
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) =>
                            const Divider(height: 1, indent: 72),
                        itemBuilder: (ctx, i) {
                          final p = filtered[i];
                          return ListTile(
                            leading: UserAvatar(
                              name: p.userName ?? 'Member',
                              imageUrl: p.userPicture,
                            ),
                            title: Text(p.userName ?? 'Member'),
                            subtitle: p.userCity != null || p.userCountry != null
                                ? Text([p.userCity, p.userCountry]
                                    .whereType<String>()
                                    .join(', '))
                                : null,
                            trailing: UiStatusBadge(
                              label: p.status.isNotEmpty
                                  ? p.status[0].toUpperCase() + p.status.substring(1)
                                  : 'Unknown',
                              status: UiStatusBadge.fromString(p.status),
                            ),
                          );
                        },
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Guests tab
// ---------------------------------------------------------------------------

class _GuestsTab extends ConsumerWidget {
  const _GuestsTab({required this.eventId});
  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final guestsAsync = ref.watch(eventGuestsProvider(eventId));
    final theme = Theme.of(context);

    return guestsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorDisplay(
        message: e.toString(),
        onRetry: () => ref.invalidate(eventGuestsProvider(eventId)),
      ),
      data: (result) {
        final (guests, summary) = result;
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Icon(Icons.person_outline,
                      size: 16, color: theme.colorScheme.primary),
                  const SizedBox(width: 6),
                  Text(
                    '${summary.total} guest${summary.total == 1 ? '' : 's'} · ${summary.confirmed} confirmed',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: guests.isEmpty
                  ? Center(
                      child: Text('No guests.',
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(color: AppThemeTokens.darkTextSecondary)))
                  : RefreshIndicator(
                      onRefresh: () async =>
                          ref.invalidate(eventGuestsProvider(eventId)),
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        itemCount: guests.length,
                        separatorBuilder: (_, __) =>
                            const Divider(height: 1, indent: 56),
                        itemBuilder: (ctx, i) {
                          final g = guests[i];
                          return ListTile(
                            leading: CircleAvatar(
                              child: Text(
                                g.name.isNotEmpty
                                    ? g.name[0].toUpperCase()
                                    : '?',
                              ),
                            ),
                            title: Text(g.name),
                            trailing: UiStatusBadge(
                              label: g.status.isNotEmpty
                                  ? g.status[0].toUpperCase() + g.status.substring(1)
                                  : 'Unknown',
                              status: UiStatusBadge.fromString(g.status),
                            ),
                          );
                        },
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Shared widgets
// ---------------------------------------------------------------------------

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
    required this.label,
    required this.count,
    required this.onTap,
    required this.selected,
    this.color,
  });

  final String label;
  final int count;
  final VoidCallback onTap;
  final bool selected;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected
              ? (color ?? theme.colorScheme.primary).withValues(alpha: 0.15)
              : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(20),
          border: selected
              ? Border.all(
                  color: color ?? theme.colorScheme.primary, width: 1.5)
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                    color: selected ? (color ?? theme.colorScheme.primary) : null)),
            const SizedBox(width: 4),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: color?.withValues(alpha: 0.2) ??
                    theme.colorScheme.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('$count',
                  style: TextStyle(
                      fontSize: 11,
                      color: color ?? theme.colorScheme.primary,
                      fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}

