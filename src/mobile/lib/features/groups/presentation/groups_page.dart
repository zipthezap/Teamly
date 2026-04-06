import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../state/groups_notifier.dart';

class GroupsPage extends ConsumerWidget {
  const GroupsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupsAsync = ref.watch(groupsNotifierProvider);
    final theme = Theme.of(context);

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
                return UiEmptyState(
                  icon: Icons.group_outlined,
                  message: "You're not in any groups yet.\nCreate or join one to get started!",
                  action: () => context.push('/groups/new'),
                  actionLabel: 'Create Group',
                );
              }

              return RefreshIndicator(
                onRefresh: () => ref.read(groupsNotifierProvider.notifier).load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 80),
                  itemCount: groups.length,
                  itemBuilder: (context, index) {
                    final group = groups[index];
                    final meta = [
                      if (group.sportType != null) group.sportType!,
                      '${group.memberCount} member${group.memberCount == 1 ? '' : 's'}',
                      if (group.city != null) group.city!,
                    ].join(' · ');

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Card(
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () => context.push('/groups/${group.id}'),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            child: Row(
                              children: [
                                UserAvatar(
                                  name: group.name,
                                  imageUrl: group.profilePicture,
                                  radius: 24,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        group.name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: theme.textTheme.titleSmall,
                                      ),
                                      if (meta.isNotEmpty) ...[
                                        const SizedBox(height: 3),
                                        Text(
                                          meta,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppThemeTokens.darkTextSecondary,
                                          ),
                                        ),
                                      ],
                                      if (group.description != null && group.description!.isNotEmpty) ...[
                                        const SizedBox(height: 3),
                                        Text(
                                          group.description!,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppThemeTokens.darkTextSecondary,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    const Icon(
                                      Icons.chevron_right,
                                      color: AppThemeTokens.darkTextSecondary,
                                    ),
                                    if (!group.isPublic)
                                      const Icon(
                                        Icons.lock_outline,
                                        size: 14,
                                        color: AppThemeTokens.darkTextSecondary,
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
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
