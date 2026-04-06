import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../state/groups_notifier.dart';

class GroupsPage extends ConsumerWidget {
  const GroupsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupsAsync = ref.watch(groupsNotifierProvider);

    return MobileShell(
      title: 'My Groups',
      currentIndex: 1,
      actions: [
        IconButton(
          icon: const Icon(Icons.explore_outlined),
          tooltip: 'Discover groups',
          onPressed: () => context.push('/discover/public-groups'),
        ),
      ],
      child: Stack(
        children: [
          groupsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => ErrorDisplay(
              message: e.toString(),
              onRetry: () => ref.read(groupsNotifierProvider.notifier).load(),
            ),
            data: (groups) {
              if (groups.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.group_outlined,
                            size: 56, color: Colors.grey),
                        const SizedBox(height: 12),
                        const Text(
                          "You're not in any groups yet.",
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey),
                        ),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: () => context.push('/groups/new'),
                          icon: const Icon(Icons.add),
                          label: const Text('Create Group'),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () => ref.read(groupsNotifierProvider.notifier).load(),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(0, 8, 0, 80),
                  itemCount: groups.length,
                  separatorBuilder: (_, __) =>
                      const Divider(height: 1, indent: 72),
                  itemBuilder: (context, index) {
                    final group = groups[index];
                    return ListTile(
                      leading: UserAvatar(
                        name: group.name,
                        imageUrl: group.profilePicture,
                        radius: 22,
                      ),
                      title: Text(
                        group.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        [
                          if (group.sportType != null) group.sportType!,
                          '${group.memberCount} member${group.memberCount == 1 ? '' : 's'}',
                          if (group.city != null) group.city!,
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/groups/${group.id}'),
                    );
                  },
                ),
              );
            },
          ),
          // FAB overlay
          Positioned(
            bottom: 16,
            right: 16,
            child: FloatingActionButton(
              onPressed: () => context.push('/groups/new'),
              tooltip: 'Create group',
              child: const Icon(Icons.add),
            ),
          ),
        ],
      ),
    );
  }
}
