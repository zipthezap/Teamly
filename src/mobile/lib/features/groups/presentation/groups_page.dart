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
                  icon: Icons.groups_2_rounded,
                  title: 'No groups yet',
                  message: "You're not in any groups yet.\nCreate or join one to get started!",
                  action: () => context.push('/groups/new'),
                  actionLabel: 'Create Group',
                  actionIcon: Icons.group_add_rounded,
                );
              }

              return RefreshIndicator(
                onRefresh: () => ref.read(groupsNotifierProvider.notifier).load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
                  itemCount: groups.length,
                  itemBuilder: (context, index) {
                    final group = groups[index];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _GroupCard(group: group),
                    );
                  },
                ),
              );
            },
          ),
          Positioned(
            bottom: 20,
            right: 20,
            child: FloatingActionButton.extended(
              onPressed: () => context.push('/groups/new'),
              icon: const Icon(Icons.add_rounded),
              label: const Text('New Group', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group});
  final dynamic group;

  Color _sportColor() {
    switch ((group.sportType as String?)?.toLowerCase()) {
      case 'football':
      case 'soccer':
        return const Color(0xFF4CAF50);
      case 'basketball':
        return const Color(0xFFFF9800);
      case 'tennis':
        return const Color(0xFFFFEB3B);
      case 'running':
        return const Color(0xFF00BCD4);
      case 'cycling':
        return const Color(0xFF2196F3);
      case 'volleyball':
        return const Color(0xFF9C27B0);
      default:
        return AppThemeTokens.primary500;
    }
  }

  @override
  Widget build(BuildContext context) {
    final sportColor = _sportColor();
    final memberCount = group.memberCount as int? ?? 0;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: () => context.push('/groups/${group.id}'),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: Container(
          decoration: BoxDecoration(
            color: AppThemeTokens.darkCard,
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(color: AppThemeTokens.darkBorder),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Avatar with sport color ring
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: sportColor.withValues(alpha: 0.4),
                      width: 2,
                    ),
                  ),
                  child: UserAvatar(
                    name: group.name as String,
                    imageUrl: group.profilePicture as String?,
                    radius: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              group.name as String,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                                color: AppThemeTokens.darkText,
                              ),
                            ),
                          ),
                          if (group.sportType != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: sportColor.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(100),
                              ),
                              child: Text(
                                group.sportType as String,
                                style: TextStyle(
                                  fontSize: 10,
                                  color: sportColor,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(
                            Icons.people_outline,
                            size: 13,
                            color: AppThemeTokens.darkTextSecondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '$memberCount member${memberCount == 1 ? '' : 's'}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppThemeTokens.darkTextSecondary,
                            ),
                          ),
                          if ((group.city as String?) != null) ...[
                            const SizedBox(width: 10),
                            const Icon(Icons.place_rounded, size: 12, color: AppThemeTokens.darkTextSecondary),
                            const SizedBox(width: 3),
                            Expanded(
                              child: Text(
                                group.city as String,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppThemeTokens.darkTextSecondary,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      if ((group.description as String?) != null &&
                          (group.description as String).isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          group.description as String,
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
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: AppThemeTokens.darkTextSecondary,
                      size: 20,
                    ),
                    if (!(group.isPublic as bool? ?? true))
                      const Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: Icon(
                          Icons.lock_rounded,
                          size: 13,
                          color: AppThemeTokens.darkTextSecondary,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
