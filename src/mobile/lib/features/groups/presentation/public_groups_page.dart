import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/models/group_model.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../features/dashboard/state/dashboard_notifier.dart';
import '../../../features/sessions/state/sessions_notifier.dart';
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
  final _scrollCtrl = ScrollController();
  String _searchQuery = '';
  final Map<String, bool> _requesting = {};

  // Paginated state
  final List<GroupModel> _groups = [];
  String? _nextCursor;
  bool _hasMore = true;
  bool _isLoading = true;
  bool _isLoadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _groups.clear();
      _nextCursor = null;
      _hasMore = true;
    });
    try {
      final (groups, nextCursor) = await ref
          .read(groupRepositoryProvider)
          .getPublicGroupsPaginated();
      if (!mounted) return;
      setState(() {
        _groups.addAll(groups);
        _nextCursor = nextCursor;
        _hasMore = nextCursor != null;
        _isLoading = false;
      });
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() {
        _error = extractErrorMessage(e);
        _isLoading = false;
      });
    }
  }

  void _onScroll() {
    if (_scrollCtrl.position.extentAfter < 200 &&
        !_isLoadingMore &&
        _hasMore &&
        _nextCursor != null) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !_hasMore || _nextCursor == null) return;
    setState(() => _isLoadingMore = true);
    try {
      final (groups, nextCursor) = await ref
          .read(groupRepositoryProvider)
          .getPublicGroupsPaginated(cursor: _nextCursor);
      if (!mounted) return;
      setState(() {
        _groups.addAll(groups);
        _nextCursor = nextCursor;
        _hasMore = nextCursor != null;
        _isLoadingMore = false;
      });
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() => _isLoadingMore = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to load more: ${extractErrorMessage(e)}'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _apply(GroupModel group) async {
    setState(() => _requesting[group.id] = true);
    try {
      await ref.read(groupRepositoryProvider).requestJoinGroup(group.id);
      ref.invalidate(myJoinRequestsProvider);
      ref.invalidate(groupDetailProvider(group.id));
      await ref.read(groupsNotifierProvider.notifier).reload();
      await ref.read(sessionsNotifierProvider.notifier).reload();
      await ref.read(dashboardNotifierProvider.notifier).reload();
      await _loadInitial();

      if (!mounted) return;
      final message = group.autoApproveJoinRequests
          ? 'You joined "${group.name}"!'
          : 'Join request sent to "${group.name}"';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(extractErrorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _requesting[group.id] = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = ref.watch(authNotifierProvider).user?.id;

    // Badge counts for the mail icon
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

    // Set of group IDs the user has already requested to join
    final pendingGroupIds = myRequestsAsync.maybeWhen(
      data: (list) => list.map((r) => r.groupId).toSet(),
      orElse: () => <String>{},
    );

    final filtered = _searchQuery.isEmpty
        ? _groups
        : _groups
            .where(
              (g) =>
                  g.name.toLowerCase().contains(_searchQuery) ||
                  (g.description?.toLowerCase().contains(_searchQuery) ??
                      false) ||
                  (g.city?.toLowerCase().contains(_searchQuery) ?? false),
            )
            .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover Groups'),
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
              tooltip: 'My Requests & Invites',
              onPressed: () => context.push('/groups/my-requests'),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: Theme.of(context).dividerColor),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorDisplay(
                  message: _error!,
                  onRetry: _loadInitial,
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    await _loadInitial();
                    ref.invalidate(myJoinRequestsProvider);
                  },
                  child: ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    itemCount: filtered.isEmpty
                        ? 2
                        : filtered.length + 1 + (_isLoadingMore ? 1 : 0),
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
                          title: _searchQuery.isNotEmpty
                              ? 'No results'
                              : 'No groups yet',
                          message: _searchQuery.isNotEmpty
                              ? 'No groups match "$_searchQuery"'
                              : 'There are no public groups to join right now.',
                        );
                      }
                      // Load-more spinner
                      if (index == filtered.length + 1) {
                        return _isLoadingMore
                            ? const Padding(
                                padding: EdgeInsets.symmetric(vertical: 20),
                                child: Center(
                                    child: CircularProgressIndicator()),
                              )
                            : const SizedBox.shrink();
                      }
                      final group = filtered[index - 1];
                      final isMember = currentUserId != null &&
                          group.members.any((m) => m.id == currentUserId);
                      final hasPendingRequest =
                          pendingGroupIds.contains(group.id);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _PublicGroupCard(
                          group: group,
                          requesting: _requesting[group.id] == true,
                          isMember: isMember,
                          hasPendingRequest: hasPendingRequest,
                          onApply: () => _apply(group),
                          onTap: () => context.push('/groups/${group.id}'),
                        ),
                      );
                    },
                  ),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
    final borderColor = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final mainText = isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText;
    final mutedText = isDark ? AppThemeTokens.darkTextMuted : AppThemeTokens.lightTextMuted;
    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusLg),
        border: Border.all(color: borderColor),
      ),
      child: TextField(
        controller: controller,
        style: TextStyle(color: mainText, fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Search groups…',
          hintStyle: TextStyle(color: mutedText, fontSize: 14),
          prefixIcon: Icon(Icons.search_rounded,
              color: isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary,
              size: 20),
          suffixIcon: query.isNotEmpty
              ? IconButton(
                  icon: Icon(Icons.close_rounded,
                      color: isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary,
                      size: 18),
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
    required this.requesting,
    required this.isMember,
    required this.hasPendingRequest,
    required this.onApply,
    required this.onTap,
  });

  final GroupModel group;
  final bool requesting;
  final bool isMember;
  final bool hasPendingRequest;
  final VoidCallback onApply;
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
    final borderColor = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final titleColor = isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText;
    final secondaryColor = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;
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
            color: cardColor,
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(color: borderColor),
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
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: titleColor,
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
                        Icon(Icons.people_outline_rounded,
                            size: 12,
                            color: secondaryColor),
                        const SizedBox(width: 3),
                        Text(
                          '$memberCount member${memberCount == 1 ? '' : 's'}',
                          style: TextStyle(
                            fontSize: 12,
                            color: secondaryColor,
                          ),
                        ),
                        if (group.city != null) ...[
                          const SizedBox(width: 8),
                          Icon(Icons.place_outlined,
                              size: 12,
                              color: secondaryColor),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              group.city!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12,
                                color: secondaryColor,
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
              requesting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : isMember
                      ? _SmallOutlinedButton(
                          label: 'View',
                          onPressed: onTap,
                        )
                      : hasPendingRequest
                          ? _SmallPendingButton()
                          : _SmallFilledButton(
                              label: group.autoApproveJoinRequests
                                  ? 'Join'
                                  : 'Apply',
                              color: AppThemeTokens.primary500,
                              onPressed: onApply,
                            ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Reusable small buttons ────────────────────────────────────────────────────

class _SmallPendingButton extends StatelessWidget {
  const _SmallPendingButton();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppThemeTokens.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
        border: Border.all(
            color: AppThemeTokens.warning.withValues(alpha: 0.4)),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.hourglass_top_rounded,
              size: 11, color: AppThemeTokens.warning),
          SizedBox(width: 4),
          Text(
            'Pending',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppThemeTokens.warning,
            ),
          ),
        ],
      ),
    );
  }
}

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
