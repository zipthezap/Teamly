import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../state/groups_notifier.dart';

enum _GroupFilter { all, publicOnly, privateOnly }

class GroupsPage extends ConsumerStatefulWidget {
  const GroupsPage({super.key});

  @override
  ConsumerState<GroupsPage> createState() => _GroupsPageState();
}

class _GroupsPageState extends ConsumerState<GroupsPage> {
  final _searchCtrl = TextEditingController();
  _GroupFilter _filter = _GroupFilter.all;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final groupsAsync = ref.watch(groupsNotifierProvider);
    final theme = Theme.of(context);
    final query = _searchCtrl.text.trim().toLowerCase();

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
              final filteredGroups = groups.where((group) {
                final matchesFilter = switch (_filter) {
                  _GroupFilter.all => true,
                  _GroupFilter.publicOnly => group.isPublic,
                  _GroupFilter.privateOnly => !group.isPublic,
                };

                if (!matchesFilter) return false;
                if (query.isEmpty) return true;

                final haystack = [
                  group.name,
                  group.description,
                  group.sportType,
                  group.city,
                  group.country,
                  group.locationName,
                  group.tags,
                ].whereType<String>().join(' ').toLowerCase();

                return haystack.contains(query);
              }).toList();

              if (groups.isEmpty) {
                return UiEmptyState(
                  icon: Icons.group_outlined,
                  message:
                      "You're not in any groups yet.\nCreate or join one to get started!",
                  action: () => context.push('/groups/new'),
                  actionLabel: 'Create Group',
                );
              }

              return RefreshIndicator(
                onRefresh: () =>
                    ref.read(groupsNotifierProvider.notifier).load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 92),
                  itemCount: filteredGroups.length + 1,
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      final publicCount =
                          groups.where((g) => g.isPublic).length;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: _GroupSummaryTile(
                                    label: 'Groups',
                                    value: '${groups.length}',
                                    icon: Icons.group_outlined,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _GroupSummaryTile(
                                    label: 'Public',
                                    value: '$publicCount',
                                    icon: Icons.public_outlined,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _GroupSummaryTile(
                                    label: 'Private',
                                    value: '${groups.length - publicCount}',
                                    icon: Icons.lock_outline,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _searchCtrl,
                              onChanged: (_) => setState(() {}),
                              decoration: InputDecoration(
                                hintText: 'Search groups, sports, tags',
                                prefixIcon: const Icon(Icons.search),
                                suffixIcon: query.isEmpty
                                    ? null
                                    : IconButton(
                                        icon: const Icon(Icons.close),
                                        onPressed: () {
                                          _searchCtrl.clear();
                                          setState(() {});
                                        },
                                      ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: _GroupFilter.values.map((filter) {
                                final label = switch (filter) {
                                  _GroupFilter.all => 'All',
                                  _GroupFilter.publicOnly => 'Public',
                                  _GroupFilter.privateOnly => 'Private',
                                };
                                return Padding(
                                  padding: const EdgeInsets.only(right: 8),
                                  child: ChoiceChip(
                                    label: Text(label),
                                    selected: _filter == filter,
                                    onSelected: (_) =>
                                        setState(() => _filter = filter),
                                  ),
                                );
                              }).toList(),
                            ),
                            if (filteredGroups.isEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 24),
                                child: UiEmptyState(
                                  icon: Icons.search_off_outlined,
                                  message:
                                      'No groups match the current filters.',
                                  action: () {
                                    _searchCtrl.clear();
                                    setState(() => _filter = _GroupFilter.all);
                                  },
                                  actionLabel: 'Reset filters',
                                ),
                              ),
                          ],
                        ),
                      );
                    }

                    final group = filteredGroups[index - 1];
                    final meta = [
                      if (group.sportType != null) group.sportType!,
                      '${group.memberCount} member${group.memberCount == 1 ? '' : 's'}',
                      if (group.count?.events != null)
                        '${group.count!.events} event${group.count!.events == 1 ? '' : 's'}',
                      if (group.city != null) group.city!,
                    ].join(' · ');

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Card(
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () => context.push('/groups/${group.id}'),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 12),
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
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
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
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppThemeTokens
                                                .darkTextSecondary,
                                          ),
                                        ),
                                      ],
                                      if (group.description != null &&
                                          group.description!.isNotEmpty) ...[
                                        const SizedBox(height: 3),
                                        Text(
                                          group.description!,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppThemeTokens
                                                .darkTextSecondary,
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: 6),
                                      Wrap(
                                        spacing: 6,
                                        runSpacing: 6,
                                        children: [
                                          _GroupTag(
                                            label: group.isPublic
                                                ? 'Public'
                                                : 'Private',
                                            icon: group.isPublic
                                                ? Icons.public_outlined
                                                : Icons.lock_outline,
                                          ),
                                          if (group.maxMembers != null)
                                            _GroupTag(
                                              label:
                                                  '${group.memberCount}/${group.maxMembers}',
                                              icon: Icons.people_outline,
                                            ),
                                          if (group.allowMemberInvites)
                                            const _GroupTag(
                                              label: 'Member invites',
                                              icon: Icons
                                                  .person_add_alt_1_outlined,
                                            ),
                                        ],
                                      ),
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

class _GroupSummaryTile extends StatelessWidget {
  const _GroupSummaryTile({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return UiCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.primary),
          const SizedBox(height: 10),
          Text(value, style: theme.textTheme.titleLarge),
          Text(
            label,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: AppThemeTokens.darkTextSecondary),
          ),
        ],
      ),
    );
  }
}

class _GroupTag extends StatelessWidget {
  const _GroupTag({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCardHover,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppThemeTokens.darkBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: AppThemeTokens.darkTextSecondary),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppThemeTokens.darkTextSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
