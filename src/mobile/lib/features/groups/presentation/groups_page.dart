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
    final query = _searchCtrl.text.trim().toLowerCase();

    // Count pending invitations + pending join requests for badge display
    final invitationsAsync = ref.watch(userInvitationsProvider);
    final myRequestsAsync = ref.watch(myJoinRequestsProvider);
    final pendingInvites = invitationsAsync.maybeWhen(
      data: (list) => list.length,
      orElse: () => 0,
    );
    final pendingRequests = myRequestsAsync.maybeWhen(
      data: (list) => list.length,
      orElse: () => 0,
    );
    final totalPending = pendingInvites + pendingRequests;

    return MobileShell(
      title: 'My Groups',
      currentIndex: 1,
      actions: [
        Badge(
          isLabelVisible: totalPending > 0,
          label: Text(
            totalPending > 99 ? '99+' : '$totalPending',
            style: const TextStyle(fontSize: 10, color: Colors.white),
          ),
          backgroundColor: AppThemeTokens.error,
          child: IconButton(
            icon: const Icon(Icons.mail_outline_rounded),
            tooltip: 'Requests & Invites',
            onPressed: () => context.push('/groups/my-requests'),
          ),
        ),
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
                  icon: Icons.groups_2_rounded,
                  title: 'No groups yet',
                  message:
                      "You're not in any groups yet.\nCreate or join one to get started!",
                  action: () => context.push('/groups/new'),
                  actionLabel: 'Create Group',
                  actionIcon: Icons.group_add_rounded,
                );
              }

              return RefreshIndicator(
                onRefresh: () =>
                    ref.read(groupsNotifierProvider.notifier).load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
                  itemCount: filteredGroups.length + 1,
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      final publicCount =
                          groups.where((g) => g.isPublic).length;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Column(
                          children: [
                            // Stats row
                            Row(
                              children: [
                                Expanded(
                                  child: _GroupStatPill(
                                    label: 'Groups',
                                    value: '${groups.length}',
                                    icon: Icons.groups_2_rounded,
                                    color: AppThemeTokens.primary500,
                                    onTap: () => setState(
                                        () => _filter = _GroupFilter.all),
                                    selected: _filter == _GroupFilter.all,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: _GroupStatPill(
                                    label: 'Public',
                                    value: '$publicCount',
                                    icon: Icons.public_rounded,
                                    color: const Color(0xFF4CAF50),
                                    onTap: () => setState(
                                        () => _filter = _GroupFilter.publicOnly),
                                    selected:
                                        _filter == _GroupFilter.publicOnly,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: _GroupStatPill(
                                    label: 'Private',
                                    value: '${groups.length - publicCount}',
                                    icon: Icons.lock_rounded,
                                    color: const Color(0xFF7C4DFF),
                                    onTap: () => setState(() =>
                                        _filter = _GroupFilter.privateOnly),
                                    selected:
                                        _filter == _GroupFilter.privateOnly,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            // Search field
                            TextField(
                              controller: _searchCtrl,
                              onChanged: (_) => setState(() {}),
                              decoration: InputDecoration(
                                hintText: 'Search groups, sports, tags…',
                                prefixIcon: const Icon(Icons.search_rounded),
                                suffixIcon: query.isEmpty
                                    ? null
                                    : IconButton(
                                        icon: const Icon(Icons.close_rounded),
                                        onPressed: () {
                                          _searchCtrl.clear();
                                          setState(() {});
                                        },
                                      ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            // Filter chips
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
                                  icon: Icons.search_off_rounded,
                                  message:
                                      'No groups match the current filters.',
                                  action: () {
                                    _searchCtrl.clear();
                                    setState(
                                        () => _filter = _GroupFilter.all);
                                  },
                                  actionLabel: 'Reset filters',
                                ),
                              ),
                          ],
                        ),
                      );
                    }

                    final group = filteredGroups[index - 1];
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
              label: const Text('New Group',
                  style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Group stat pill ───────────────────────────────────────────────────────────

class _GroupStatPill extends StatelessWidget {
  const _GroupStatPill({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.onTap,
    required this.selected,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
        decoration: BoxDecoration(
          color: selected
              ? color.withValues(alpha: 0.12)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
          border: Border.all(
            color: selected
                ? color.withValues(alpha: 0.4)
                : AppThemeTokens.darkBorder,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: AppThemeTokens.darkTextSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Group card ────────────────────────────────────────────────────────────────

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

    final meta = [
      if ((group.sportType as String?) != null) group.sportType as String,
      '$memberCount member${memberCount == 1 ? '' : 's'}',
      if ((group.count?.events as int?) != null)
        '${group.count!.events} event${group.count!.events == 1 ? '' : 's'}',
      if ((group.city as String?) != null) group.city as String,
    ].join(' · ');

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: () => context.push('/groups/${group.id}'),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: AppThemeTokens.darkBorder.withValues(alpha: 0.8),
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
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
                const SizedBox(width: 12),
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
                          if ((group.sportType as String?) != null)
                            Container(
                              margin: const EdgeInsets.only(left: 6),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 7, vertical: 2),
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
                      if (meta.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          meta,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppThemeTokens.darkTextSecondary,
                          ),
                        ),
                      ],
                      if ((group.description as String?) != null &&
                          (group.description as String).isNotEmpty) ...[
                        const SizedBox(height: 3),
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
                      const SizedBox(height: 5),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          _GroupTag(
                            label: (group.isPublic as bool? ?? true)
                                ? 'Public'
                                : 'Private',
                            icon: (group.isPublic as bool? ?? true)
                                ? Icons.public_rounded
                                : Icons.lock_rounded,
                            color: (group.isPublic as bool? ?? true)
                                ? const Color(0xFF4CAF50)
                                : const Color(0xFF7C4DFF),
                          ),
                          if ((group.maxMembers as int?) != null)
                            _GroupTag(
                              label:
                                  '$memberCount/${group.maxMembers as int}',
                              icon: Icons.people_outline,
                            ),
                          if (group.allowMemberInvites as bool? ?? false)
                            const _GroupTag(
                              label: 'Member invites',
                              icon: Icons.person_add_alt_1_rounded,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.chevron_right_rounded,
                        color: AppThemeTokens.darkTextSecondary, size: 20),
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

// ── Group tag chip ────────────────────────────────────────────────────────────

class _GroupTag extends StatelessWidget {
  const _GroupTag({required this.label, this.icon, this.color});

  final String label;
  final IconData? icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final fg = color ?? AppThemeTokens.darkTextSecondary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: fg.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: fg),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: fg,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
