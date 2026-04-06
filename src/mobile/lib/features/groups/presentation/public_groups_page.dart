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
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover Groups'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search groups…',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
                filled: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16),
              ),
              onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
            ),
          ),
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

          if (filtered.isEmpty) {
            return UiEmptyState(
              icon: Icons.search_off,
              message: _searchQuery.isNotEmpty
                  ? 'No groups match "$_searchQuery"'
                  : 'No public groups found.',
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(publicGroupsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: filtered.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, indent: 72),
              itemBuilder: (context, index) {
                final group = filtered[index];
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
                      '${group.memberCount} members',
                      if (group.city != null) group.city!,
                      if (group.distance != null)
                        '${group.distance!.toStringAsFixed(1)} km away',
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: _joining
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : TextButton(
                          onPressed: () => _join(group),
                          child: const Text('Join'),
                        ),
                  onTap: () => context.push('/groups/${group.id}'),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
