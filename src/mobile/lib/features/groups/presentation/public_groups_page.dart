import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/group_model.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../data/group_repository_impl.dart';
import '../state/groups_notifier.dart';

class PublicGroupsPage extends ConsumerStatefulWidget {
  const PublicGroupsPage({super.key});

  @override
  ConsumerState<PublicGroupsPage> createState() => _PublicGroupsPageState();
}

class _PublicGroupsPageState extends ConsumerState<PublicGroupsPage> {
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';
  bool _joining = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  String _extractMsg(Exception e) {
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _join(GroupModel group) async {
    setState(() => _joining = true);
    try {
      await ref.read(groupRepositoryProvider).joinGroupByInvite(group.id);
      ref.read(groupsNotifierProvider.notifier).load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Joined "${group.name}"!')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_extractMsg(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final publicGroupsAsync = ref.watch(publicGroupsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover Groups'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: AppThemeTokens.darkBorder),
        ),
      ),
      body: publicGroupsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref.invalidate(publicGroupsProvider),
        ),
        data: (groups) {
          final filtered = _searchQuery.isEmpty
              ? groups
              : groups
                  .where(
                    (g) =>
                        g.name.toLowerCase().contains(_searchQuery) ||
                        (g.description?.toLowerCase().contains(_searchQuery) ??
                            false) ||
                        (g.city?.toLowerCase().contains(_searchQuery) ?? false),
                  )
                  .toList();

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(publicGroupsProvider),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: filtered.isEmpty ? 2 : filtered.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _SearchBar(
                      controller: _searchCtrl,
                      query: _searchQuery,
                      onChanged: (v) =>
                          setState(() => _searchQuery = v.toLowerCase()),
                      onClear: () {
                        _searchCtrl.clear();
                        setState(() => _searchQuery = '');
                      },
                    ),
                  );
                }
                if (filtered.isEmpty) {
                  return UiEmptyState(
                    icon: Icons.search_off_rounded,
                    title: _searchQuery.isNotEmpty ? 'No results' : 'No groups yet',
                    message: _searchQuery.isNotEmpty
                        ? 'No groups match "$_searchQuery"'
                        : 'There are no public groups to join right now.',
                  );
                }
                final group = filtered[index - 1];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _PublicGroupCard(
                    group: group,
                    joining: _joining,
                    onJoin: () => _join(group),
                    onTap: () => context.push('/groups/${group.id}'),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

// ── Search bar ────────────────────────────────────────────────────────────────

class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.query,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final String query;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCard,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusLg),
        border: Border.all(color: AppThemeTokens.darkBorder),
      ),
      child: TextField(
        controller: controller,
        style: const TextStyle(color: AppThemeTokens.darkText, fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Search groups…',
          hintStyle: const TextStyle(
              color: AppThemeTokens.darkTextMuted, fontSize: 14),
          prefixIcon: const Icon(Icons.search_rounded,
              color: AppThemeTokens.darkTextSecondary, size: 20),
          suffixIcon: query.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.close_rounded,
                      color: AppThemeTokens.darkTextSecondary, size: 18),
                  onPressed: onClear,
                )
              : null,
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        onChanged: onChanged,
      ),
    );
  }
}

// ── Group card ────────────────────────────────────────────────────────────────

class _PublicGroupCard extends StatelessWidget {
  const _PublicGroupCard({
    required this.group,
    required this.joining,
    required this.onJoin,
    required this.onTap,
  });

  final GroupModel group;
  final bool joining;
  final VoidCallback onJoin;
  final VoidCallback onTap;

  Color _sportColor() {
    switch (group.sportType?.toLowerCase()) {
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
    final memberCount = group.memberCount;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: Container(
          decoration: BoxDecoration(
            color: AppThemeTokens.darkCard,
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(color: AppThemeTokens.darkBorder),
          ),
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              // Avatar with sport-color ring
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: sportColor.withValues(alpha: 0.45), width: 2),
                ),
                child: UserAvatar(
                  name: group.name,
                  imageUrl: group.profilePicture,
                  radius: 24,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name + sport pill
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            group.name,
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
                            margin: const EdgeInsets.only(left: 6),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: sportColor.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(100),
                            ),
                            child: Text(
                              group.sportType!,
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
                    // Meta row
                    Row(
                      children: [
                        const Icon(Icons.people_outline_rounded,
                            size: 12,
                            color: AppThemeTokens.darkTextSecondary),
                        const SizedBox(width: 3),
                        Text(
                          '$memberCount member${memberCount == 1 ? '' : 's'}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppThemeTokens.darkTextSecondary,
                          ),
                        ),
                        if (group.city != null) ...[
                          const SizedBox(width: 8),
                          const Icon(Icons.place_outlined,
                              size: 12,
                              color: AppThemeTokens.darkTextSecondary),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              group.city!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppThemeTokens.darkTextSecondary,
                              ),
                            ),
                          ),
                        ],
                        if (group.distance != null) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppThemeTokens.primary500
                                  .withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(100),
                            ),
                            child: Text(
                              '${group.distance!.toStringAsFixed(1)} km',
                              style: const TextStyle(
                                fontSize: 10,
                                color: AppThemeTokens.primary400,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // Action button
              joining
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child:
                          CircularProgressIndicator(strokeWidth: 2),
                    )
                  : group.distance != null
                      ? _SmallFilledButton(
                          label: 'Join',
                          color: AppThemeTokens.primary500,
                          onPressed: onJoin,
                        )
                      : _SmallOutlinedButton(
                          label: 'View',
                          onPressed: onTap,
                        ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Reusable small buttons ────────────────────────────────────────────────────

class _SmallFilledButton extends StatelessWidget {
  const _SmallFilledButton({
    required this.label,
    required this.color,
    required this.onPressed,
  });

  final String label;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          gradient: AppThemeTokens.primaryGradient,
          borderRadius:
              BorderRadius.circular(AppThemeTokens.radiusSm),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class _SmallOutlinedButton extends StatelessWidget {
  const _SmallOutlinedButton({
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: AppThemeTokens.primary500),
          borderRadius:
              BorderRadius.circular(AppThemeTokens.radiusSm),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppThemeTokens.primary400,
          ),
        ),
      ),
    );
  }
}
