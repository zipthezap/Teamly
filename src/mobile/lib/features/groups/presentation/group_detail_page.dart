import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../features/events/state/events_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../state/groups_notifier.dart';

class GroupDetailPage extends ConsumerWidget {
  const GroupDetailPage({super.key, required this.groupId});

  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupAsync = ref.watch(groupDetailProvider(groupId));
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: groupAsync.maybeWhen(
          data: (g) => Text(g.name),
          orElse: () => const Text('Group'),
        ),
      ),
      body: groupAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref.invalidate(groupDetailProvider(groupId)),
        ),
        data: (group) {
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(groupDetailProvider(groupId)),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Header card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        UserAvatar(
                          name: group.name,
                          imageUrl: group.profilePicture,
                          radius: 32,
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(group.name, style: theme.textTheme.titleLarge),
                              if (group.sportType != null) ...[
                                const SizedBox(height: 4),
                                Chip(
                                  label: Text(group.sportType!),
                                  padding: EdgeInsets.zero,
                                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
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

                // Info row
                Row(
                  children: [
                    _InfoChip(
                      icon: Icons.people_outline,
                      label: '${group.memberCount} member${group.memberCount == 1 ? '' : 's'}',
                    ),
                    const SizedBox(width: 8),
                    _InfoChip(
                      icon: group.isPublic ? Icons.public : Icons.lock_outline,
                      label: group.isPublic ? 'Public' : 'Private',
                    ),
                    if (group.city != null) ...[
                      const SizedBox(width: 8),
                      _InfoChip(icon: Icons.place_outlined, label: group.city!),
                    ],
                  ],
                ),

                if (group.description != null && group.description!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('About', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 6),
                  Text(group.description!, style: theme.textTheme.bodyMedium),
                ],

                const SizedBox(height: 20),

                // Members section
                Text('Members', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                ...group.members.take(20).map(
                  (member) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: UserAvatar(
                      name: member.name,
                      imageUrl: member.profilePicture,
                    ),
                    title: Text(member.name),
                    subtitle: Text(member.email),
                    trailing: member.role == 'admin'
                        ? Chip(
                            label: const Text('Admin'),
                            padding: EdgeInsets.zero,
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          )
                        : null,
                  ),
                ),

                if (group.members.length > 20)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      '+${group.members.length - 20} more members',
                      style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey),
                    ),
                  ),

                const SizedBox(height: 20),

                // Events section
                Text('Events', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                _GroupEventsSection(groupId: group.id),

                const SizedBox(height: 20),

                // Created at
                Text(
                  'Created ${DateFormat.yMMMd().format(group.createdAt)}',
                  style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}

class _GroupEventsSection extends ConsumerWidget {
  const _GroupEventsSection({required this.groupId});

  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(groupEventsProvider(groupId));
    final theme = Theme.of(context);

    return eventsAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
      error: (e, _) => Text(
        'Could not load events: $e',
        style: TextStyle(color: theme.colorScheme.error, fontSize: 12),
      ),
      data: (events) {
        final upcoming = events
            .where((e) => e.startTime.isAfter(DateTime.now()))
            .take(5)
            .toList();

        if (upcoming.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'No upcoming events.',
              style: TextStyle(color: Colors.grey),
            ),
          );
        }

        return Column(
          children: upcoming.map((event) {
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                backgroundColor: theme.colorScheme.primaryContainer,
                child: Text(
                  DateFormat('d').format(event.startTime.toLocal()),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onPrimaryContainer,
                    fontSize: 13,
                  ),
                ),
              ),
              title: Text(
                event.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                DateFormat('EEE, MMM d · h:mm a')
                    .format(event.startTime.toLocal()),
                style: const TextStyle(fontSize: 11),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/events/${event.id}'),
            );
          }).toList(),
        );
      },
    );
  }
}
