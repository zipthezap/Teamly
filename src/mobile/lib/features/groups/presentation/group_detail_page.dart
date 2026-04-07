import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/group_model.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../features/events/state/events_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../data/group_repository_impl.dart';
import '../state/groups_notifier.dart';
import 'group_form_page.dart';
import 'group_invite_analytics_page.dart';

class GroupDetailPage extends ConsumerStatefulWidget {
  const GroupDetailPage({super.key, required this.groupId});
  final String groupId;

  @override
  ConsumerState<GroupDetailPage> createState() => _GroupDetailPageState();
}

class _GroupDetailPageState extends ConsumerState<GroupDetailPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  bool _isAdmin(GroupModel group, String? userId) =>
      userId != null &&
      (group.creatorId == userId ||
          group.members.any((m) => m.id == userId && m.role == 'admin'));

  String _extractMsg(Exception e) {
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
  }

  @override
  Widget build(BuildContext context) {
    final groupAsync = ref.watch(groupDetailProvider(widget.groupId));
    final currentUserId = ref.watch(authNotifierProvider).user?.id;

    return Scaffold(
      appBar: AppBar(
        title: groupAsync.maybeWhen(
          data: (g) => Text(g.name),
          orElse: () => const Text('Group'),
        ),
        actions: [
          groupAsync.maybeWhen(
            data: (group) {
              final admin = _isAdmin(group, currentUserId);
              final isCreator = group.creatorId == currentUserId;
              if (admin || isCreator || currentUserId == null) {
                return const SizedBox.shrink();
              }
              return IconButton(
                icon: const Icon(Icons.logout),
                tooltip: 'Leave group',
                onPressed: () => _leaveGroup(group),
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),
          groupAsync.maybeWhen(
            data: (group) {
              final admin = _isAdmin(group, currentUserId);
              if (!admin) return const SizedBox.shrink();
              return PopupMenuButton<String>(
                onSelected: (a) => _handleAdminAction(a, group),
                itemBuilder: (_) => [
                  const PopupMenuItem(
                      value: 'edit',
                      child: ListTile(
                          leading: Icon(Icons.edit_outlined),
                          title: Text('Edit group'),
                          contentPadding: EdgeInsets.zero)),
                  const PopupMenuItem(
                      value: 'invite_member',
                      child: ListTile(
                          leading: Icon(Icons.person_add_outlined),
                          title: Text('Invite member'),
                          contentPadding: EdgeInsets.zero)),
                  const PopupMenuItem(
                      value: 'invite_link',
                      child: ListTile(
                          leading: Icon(Icons.link),
                          title: Text('Copy invite link'),
                          contentPadding: EdgeInsets.zero)),
                  const PopupMenuItem(
                      value: 'upload_picture',
                      child: ListTile(
                          leading: Icon(Icons.photo_camera_outlined),
                          title: Text('Change group picture'),
                          contentPadding: EdgeInsets.zero)),
                  const PopupMenuItem(
                      value: 'event_requests',
                      child: ListTile(
                          leading: Icon(Icons.how_to_vote_outlined),
                          title: Text('Event Requests'),
                          contentPadding: EdgeInsets.zero)),
                  const PopupMenuItem(
                      value: 'invite_analytics',
                      child: ListTile(
                          leading: Icon(Icons.analytics_outlined),
                          title: Text('Invite Analytics'),
                          contentPadding: EdgeInsets.zero)),
                  const PopupMenuDivider(),
                  const PopupMenuItem(
                      value: 'delete',
                      child: ListTile(
                          leading: Icon(Icons.delete_outline,
                              color: AppThemeTokens.error),
                          title: Text('Delete group',
                              style: TextStyle(color: AppThemeTokens.error)),
                          contentPadding: EdgeInsets.zero)),
                ],
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(49),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TabBar(
                controller: _tabCtrl,
                tabs: const [
                  Tab(text: 'Overview'),
                  Tab(text: 'Members'),
                  Tab(text: 'Events'),
                  Tab(text: 'Chat'),
                ],
              ),
              const Divider(height: 1, color: AppThemeTokens.darkBorder),
            ],
          ),
        ),
      ),
      body: groupAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref.invalidate(groupDetailProvider(widget.groupId)),
        ),
        data: (group) {
          final admin = _isAdmin(group, currentUserId);
          return TabBarView(
            controller: _tabCtrl,
            children: [
              _OverviewTab(group: group, isAdmin: admin, groupId: widget.groupId),
              _MembersTab(
                  group: group, isAdmin: admin, currentUserId: currentUserId),
              _EventsTab(groupId: group.id, isAdmin: admin),
              _ChatTab(groupId: group.id, currentUserId: currentUserId ?? ''),
            ],
          );
        },
      ),
    );
  }

  Future<void> _handleAdminAction(String action, GroupModel group) async {
    switch (action) {
      case 'edit':
        await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => GroupFormPage(existingGroup: group)));
        ref.invalidate(groupDetailProvider(widget.groupId));
        break;
      case 'invite_member':
        await _showInviteMemberDialog();
        break;
      case 'invite_link':
        try {
          final link = await ref
              .read(groupRepositoryProvider)
              .getInviteLink(widget.groupId);
          await Clipboard.setData(ClipboardData(text: link));
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Invite link copied!')));
          }
        } on Exception catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context)
                .showSnackBar(SnackBar(content: Text(_extractMsg(e))));
          }
        }
        break;
      case 'upload_picture':
        await _pickAndUploadPicture();
        break;
      case 'event_requests':
        context.push('/groups/${widget.groupId}/event-requests');
        break;
      case 'invite_analytics':
        await Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => GroupInviteAnalyticsPage(
            groupId: widget.groupId,
            groupName: group.name,
          ),
        ));
        break;
      case 'delete':
        final ok = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete group'),
            content: Text('Delete "${group.name}"? This cannot be undone.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(ctx).pop(false),
                  child: const Text('Cancel')),
              FilledButton(
                  style: FilledButton.styleFrom(
                      backgroundColor: Theme.of(ctx).colorScheme.error),
                  onPressed: () => Navigator.of(ctx).pop(true),
                  child: const Text('Delete')),
            ],
          ),
        );
        if (ok == true) {
          try {
            await ref.read(groupRepositoryProvider).deleteGroup(widget.groupId);
            ref.read(groupsNotifierProvider.notifier).load();
            if (mounted) context.pop();
          } on Exception catch (e) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text(_extractMsg(e)),
                  backgroundColor: Theme.of(context).colorScheme.error));
            }
          }
        }
        break;
    }
  }

  Future<void> _showInviteMemberDialog() async {
    final emailCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Invite member'),
        content: TextField(
          controller: emailCtrl,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
            labelText: 'Email address',
            hintText: 'user@example.com',
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Send invite')),
        ],
      ),
    );
    if (ok == true && mounted) {
      final email = emailCtrl.text.trim();
      if (email.isEmpty) return;
      try {
        await ref
            .read(groupRepositoryProvider)
            .inviteMember(widget.groupId, email);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Invite sent to $email')));
        }
      } on Exception catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(_extractMsg(e))));
        }
      }
    }
  }

  Future<void> _pickAndUploadPicture() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null || !mounted) return;
    try {
      await ref
          .read(groupRepositoryProvider)
          .uploadGroupPicture(widget.groupId, picked.path);
      ref.invalidate(groupDetailProvider(widget.groupId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Group picture updated!')));
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_extractMsg(e))));
      }
    }
  }

  Future<void> _leaveGroup(GroupModel group) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Leave group'),
        content: Text('Leave "${group.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
    if (ok != true) {
      return;
    }

    try {
      await ref.read(groupRepositoryProvider).leaveGroup(widget.groupId);
      ref.read(groupsNotifierProvider.notifier).load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('You left the group.')),
        );
        context.go('/groups');
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
    }
  }
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

class _OverviewTab extends ConsumerWidget {
  const _OverviewTab(
      {required this.group, required this.isAdmin, required this.groupId});
  final GroupModel group;
  final bool isAdmin;
  final String groupId;

  String _extractMsg(Exception e) {
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _showInviteMemberDialog(
      BuildContext context, WidgetRef ref) async {
    final emailCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Invite member'),
        content: TextField(
          controller: emailCtrl,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
            labelText: 'Email address',
            hintText: 'user@example.com',
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Send invite')),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      final email = emailCtrl.text.trim();
      if (email.isEmpty) return;
      try {
        await ref.read(groupRepositoryProvider).inviteMember(groupId, email);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Invite sent to $email')));
        }
      } on Exception catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(_extractMsg(e))));
        }
      }
    }
  }

  Future<void> _pickAndUploadPicture(
      BuildContext context, WidgetRef ref) async {
    final picker = ImagePicker();
    final picked =
        await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null || !context.mounted) return;
    try {
      await ref
          .read(groupRepositoryProvider)
          .uploadGroupPicture(groupId, picked.path);
      ref.invalidate(groupDetailProvider(groupId));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Group picture updated!')));
      }
    } on Exception catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_extractMsg(e))));
      }
    }
  }

  Future<void> _deletePicture(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove picture'),
        content: const Text('Remove the group picture?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(ctx).colorScheme.error),
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Remove')),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      try {
        await ref.read(groupRepositoryProvider).deleteGroupPicture(groupId);
        ref.invalidate(groupDetailProvider(groupId));
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Group picture removed.')));
        }
      } on Exception catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(_extractMsg(e))));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailRows = <Widget>[
      if (group.sportType != null)
        UiInfoRow(
          icon: Icons.sports_outlined,
          label: 'Sport',
          value: group.sportType!,
          iconColor: AppThemeTokens.primary500,
        ),
      if (group.locationName != null)
        UiInfoRow(
          icon: Icons.pin_drop_outlined,
          label: 'Location',
          value: group.locationName!,
          iconColor: AppThemeTokens.info,
        ),
      if (group.city != null)
        UiInfoRow(
          icon: Icons.place_outlined,
          label: 'City',
          value: group.city!,
          iconColor: AppThemeTokens.info,
        ),
      if (group.country != null)
        UiInfoRow(
          icon: Icons.flag_outlined,
          label: 'Country',
          value: group.country!,
          iconColor: AppThemeTokens.info,
        ),
      if (group.maxMembers != null)
        UiInfoRow(
          icon: Icons.groups_2_outlined,
          label: 'Capacity',
          value: '${group.memberCount}/${group.maxMembers} members',
          iconColor: AppThemeTokens.warning,
        ),
      UiInfoRow(
        icon: Icons.calendar_today_outlined,
        label: 'Created',
        value: DateFormat.yMMMd().format(group.createdAt),
        iconColor: AppThemeTokens.darkTextSecondary,
      ),
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Hero Card ─────────────────────────────────────────────────────
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            gradient: AppThemeTokens.heroGradient,
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusLg),
            border: Border.all(color: AppThemeTokens.darkBorder),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusLg),
            child: Stack(
              children: [
                Positioned(
                  top: -30,
                  right: -20,
                  child: Container(
                    width: 130,
                    height: 130,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppThemeTokens.primaryGlow,
                    ),
                  ),
                ),
                Positioned(
                  bottom: -40,
                  left: -20,
                  child: Container(
                    width: 110,
                    height: 110,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppThemeTokens.primary500.withValues(alpha: 0.06),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(3),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppThemeTokens.primary500,
                                width: 2,
                              ),
                            ),
                            child: UserAvatar(
                              name: group.name,
                              imageUrl: group.profilePicture,
                              radius: 36,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  group.name,
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold,
                                    color: AppThemeTokens.darkText,
                                  ),
                                ),
                                if (group.description != null &&
                                    group.description!.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    group.description!,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: AppThemeTokens.darkTextSecondary,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: [
                          if (group.sportType != null)
                            _HeroPill(
                              label: group.sportType!,
                              color: AppThemeTokens.primary500,
                            ),
                          _HeroPill(
                            icon: group.isPublic
                                ? Icons.public
                                : Icons.lock_outline,
                            label: group.isPublic ? 'Public' : 'Private',
                            color: group.isPublic
                                ? AppThemeTokens.success
                                : AppThemeTokens.warning,
                          ),
                          _HeroPill(
                            icon: Icons.people_outline,
                            label:
                                '${group.memberCount} member${group.memberCount == 1 ? '' : 's'}',
                            color: AppThemeTokens.info,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),

        // ── Group Details ─────────────────────────────────────────────────
        UiSectionTitle('Group Details'),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: AppThemeTokens.darkCard,
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(color: AppThemeTokens.darkBorder),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              children: [
                for (int i = 0; i < detailRows.length; i++) ...[
                  detailRows[i],
                  if (i < detailRows.length - 1)
                    const Divider(
                        height: 1, color: AppThemeTokens.darkBorderSubtle),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // ── Stats chips ───────────────────────────────────────────────────
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            if (group.count?.events != null)
              _InfoChip(
                  icon: Icons.event_outlined,
                  label:
                      '${group.count!.events} event${group.count!.events == 1 ? '' : 's'}'),
            _InfoChip(
              icon: group.allowMemberInvites
                  ? Icons.person_add_alt_1_outlined
                  : Icons.block_outlined,
              label: group.allowMemberInvites
                  ? 'Member invites on'
                  : 'Member invites off',
            ),
            _InfoChip(
              icon: group.autoApproveJoinRequests
                  ? Icons.flash_on_outlined
                  : Icons.fact_check_outlined,
              label: group.autoApproveJoinRequests
                  ? 'Auto-approve joins'
                  : 'Manual join approval',
            ),
          ],
        ),
        const SizedBox(height: 20),

        // ── Quick Actions ─────────────────────────────────────────────────
        UiSectionTitle('Quick Actions'),
        const SizedBox(height: 10),
        UiPrimaryButton(
          text: 'Create Event',
          icon: Icons.add_circle_outline,
          onPressed: () => context.push('/groups/${group.id}/events/new'),
        ),
        if (isAdmin) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => _showInviteMemberDialog(context, ref),
            icon: const Icon(Icons.person_add_outlined),
            label: const Text('Invite Member'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppThemeTokens.darkTextSecondary,
              side: const BorderSide(color: AppThemeTokens.darkBorder),
              minimumSize: const Size(double.infinity, 44),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
              ),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => _pickAndUploadPicture(context, ref),
            icon: const Icon(Icons.photo_camera_outlined),
            label: const Text('Change Picture'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppThemeTokens.darkTextSecondary,
              side: const BorderSide(color: AppThemeTokens.darkBorder),
              minimumSize: const Size(double.infinity, 44),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
              ),
            ),
          ),
          if (group.profilePicture != null) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => _deletePicture(context, ref),
              icon: const Icon(Icons.hide_image_outlined,
                  color: AppThemeTokens.error),
              label: const Text('Remove Picture',
                  style: TextStyle(color: AppThemeTokens.error)),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppThemeTokens.error,
                side: BorderSide(
                    color: AppThemeTokens.error.withValues(alpha: 0.4)),
                minimumSize: const Size(double.infinity, 44),
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(AppThemeTokens.radiusMd),
                ),
              ),
            ),
          ],
        ],
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => context.push('/discover/public-groups'),
          icon: const Icon(Icons.explore_outlined),
          label: const Text('Discover More'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppThemeTokens.darkTextSecondary,
            side: const BorderSide(color: AppThemeTokens.darkBorder),
            minimumSize: const Size(double.infinity, 44),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            ),
          ),
        ),

        // ── About ─────────────────────────────────────────────────────────
        if (group.description != null && group.description!.isNotEmpty) ...[
          const SizedBox(height: 20),
          UiSectionTitle('About'),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppThemeTokens.darkCard,
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
              border: Border.all(color: AppThemeTokens.darkBorder),
            ),
            child: Text(
              group.description!,
              style: const TextStyle(
                fontSize: 14,
                color: AppThemeTokens.darkTextSecondary,
                height: 1.5,
              ),
            ),
          ),
        ],

        // ── Tags ──────────────────────────────────────────────────────────
        if (group.tags != null && group.tags!.isNotEmpty) ...[
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: group.tags!
                .split(',')
                .map((t) => _InfoChip(
                      icon: Icons.label_outline,
                      label: t.trim(),
                    ))
                .toList(),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Members tab
// ---------------------------------------------------------------------------

class _MembersTab extends ConsumerWidget {
  const _MembersTab(
      {required this.group,
      required this.isAdmin,
      required this.currentUserId});
  final GroupModel group;
  final bool isAdmin;
  final String? currentUserId;

  String _extractMsg(Exception e) {
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final joinAsync =
        isAdmin ? ref.watch(joinRequestsProvider(group.id)) : null;

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 12),
      children: [
        // Pending join requests
        if (isAdmin && joinAsync != null)
          joinAsync.maybeWhen(
            data: (reqs) {
              final pending = reqs.where((r) => r.status == 'pending').toList();
              if (pending.isEmpty) return const SizedBox.shrink();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: UiSectionTitle('Join Requests (${pending.length})'),
                  ),
                  ...pending.map((req) => Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                        child: Container(
                          decoration: BoxDecoration(
                            color: AppThemeTokens.darkCard,
                            borderRadius:
                                BorderRadius.circular(AppThemeTokens.radiusMd),
                            border:
                                Border.all(color: AppThemeTokens.darkBorder),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                UserAvatar(
                                    name: req.userName,
                                    imageUrl: req.userPicture),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        req.userName,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: AppThemeTokens.darkText,
                                        ),
                                      ),
                                      if (req.userEmail != null)
                                        Text(
                                          req.userEmail!,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppThemeTokens
                                                .darkTextSecondary,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(
                                      Icons.check_circle_outline,
                                      color: AppThemeTokens.success),
                                  onPressed: () => _handleJoinReq(context, ref,
                                      group.id, req.id, 'approve'),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.cancel_outlined,
                                      color: AppThemeTokens.error),
                                  onPressed: () => _handleJoinReq(context, ref,
                                      group.id, req.id, 'reject'),
                                ),
                              ],
                            ),
                          ),
                        ),
                      )),
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 4, 16, 8),
                    child: Divider(color: AppThemeTokens.darkBorder),
                  ),
                ],
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),

        // Member list header
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: UiSectionTitle('Members (${group.memberCount})'),
        ),
        ...group.members.map((member) {
          final isSelf = member.id == currentUserId;
          final memberIsAdmin = member.role == 'admin';
          final isCreator = member.id == group.creatorId;
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Container(
              decoration: BoxDecoration(
                color: AppThemeTokens.darkCard,
                borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                border: Border.all(color: AppThemeTokens.darkBorder),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
                child: Row(
                  children: [
                    UserAvatar(
                        name: member.name,
                        imageUrl: member.profilePicture),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            member.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: AppThemeTokens.darkText,
                            ),
                          ),
                          Text(
                            member.email,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppThemeTokens.darkTextSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (isCreator)
                          const Padding(
                            padding: EdgeInsets.only(right: 4),
                            child: UiStatusBadge(
                              label: 'Creator',
                              status: UiStatusType.success,
                            ),
                          )
                        else if (memberIsAdmin)
                          const Padding(
                            padding: EdgeInsets.only(right: 4),
                            child: UiStatusBadge(
                              label: 'Admin',
                              status: UiStatusType.info,
                            ),
                          ),
                        if (isAdmin && !isSelf)
                          PopupMenuButton<String>(
                            onSelected: (a) => _handleMemberAction(
                                context, ref, group.id, member, a),
                            itemBuilder: (_) => [
                              if (!memberIsAdmin)
                                const PopupMenuItem(
                                    value: 'promote',
                                    child: Text('Promote to admin')),
                              if (!memberIsAdmin)
                                const PopupMenuItem(
                                    value: 'transfer',
                                    child: Text('Transfer admin role')),
                              const PopupMenuItem(
                                  value: 'kick',
                                  child: Text('Remove from group',
                                      style: TextStyle(
                                          color: AppThemeTokens.error))),
                            ],
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  Future<void> _handleJoinReq(BuildContext ctx, WidgetRef ref, String groupId,
      String reqId, String action) async {
    try {
      await ref
          .read(groupRepositoryProvider)
          .handleJoinRequest(groupId, reqId, action);
      ref.invalidate(joinRequestsProvider(groupId));
      ref.invalidate(groupDetailProvider(groupId));
      if (ctx.mounted) {
        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
            content: Text(action == 'approve' ? 'Approved!' : 'Rejected')));
      }
    } on Exception catch (e) {
      if (ctx.mounted) {
        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
            content: Text(_extractMsg(e)),
            backgroundColor: Theme.of(ctx).colorScheme.error));
      }
    }
  }

  Future<void> _handleMemberAction(BuildContext ctx, WidgetRef ref,
      String groupId, GroupMemberModel member, String action) async {
    switch (action) {
      case 'kick':
        final ok = await showDialog<bool>(
          context: ctx,
          builder: (c) => AlertDialog(
            title: const Text('Remove member'),
            content: Text('Remove ${member.name} from the group?'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(c).pop(false),
                  child: const Text('Cancel')),
              FilledButton(
                  style: FilledButton.styleFrom(
                      backgroundColor: Theme.of(c).colorScheme.error),
                  onPressed: () => Navigator.of(c).pop(true),
                  child: const Text('Remove')),
            ],
          ),
        );
        if (ok == true) {
          try {
            await ref
                .read(groupRepositoryProvider)
                .removeMember(groupId, member.id);
            ref.invalidate(groupDetailProvider(groupId));
          } on Exception catch (e) {
            if (ctx.mounted) {
              ScaffoldMessenger.of(ctx)
                  .showSnackBar(SnackBar(content: Text(_extractMsg(e))));
            }
          }
        }
        break;
      case 'promote':
        try {
          await ref
              .read(groupRepositoryProvider)
              .updateMemberRole(groupId, member.id, 'admin');
          ref.invalidate(groupDetailProvider(groupId));
        } on Exception catch (e) {
          if (ctx.mounted) {
            ScaffoldMessenger.of(ctx)
                .showSnackBar(SnackBar(content: Text(_extractMsg(e))));
          }
        }
        break;
      case 'transfer':
        final ok = await showDialog<bool>(
          context: ctx,
          builder: (c) => AlertDialog(
            title: const Text('Transfer admin'),
            content: Text(
                'Transfer admin role to ${member.name}? You will become a regular member.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(c).pop(false),
                  child: const Text('Cancel')),
              FilledButton(
                  onPressed: () => Navigator.of(c).pop(true),
                  child: const Text('Transfer')),
            ],
          ),
        );
        if (ok == true) {
          try {
            await ref
                .read(groupRepositoryProvider)
                .transferAdmin(groupId, member.id);
            ref.invalidate(groupDetailProvider(groupId));
          } on Exception catch (e) {
            if (ctx.mounted) {
              ScaffoldMessenger.of(ctx)
                  .showSnackBar(SnackBar(content: Text(_extractMsg(e))));
            }
          }
        }
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Events tab
// ---------------------------------------------------------------------------

class _EventsTab extends ConsumerWidget {
  const _EventsTab({required this.groupId, required this.isAdmin});
  final String groupId;
  final bool isAdmin;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(groupEventsProvider(groupId));
    final now = DateTime.now();

    return eventsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorDisplay(
        message: e.toString(),
        onRetry: () => ref.invalidate(groupEventsProvider(groupId)),
      ),
      data: (events) => Stack(
        children: [
          events.isEmpty
              ? Center(
                  child: UiEmptyState(
                    icon: Icons.event_busy_outlined,
                    message: 'This group has no events yet.',
                    action: isAdmin
                        ? () => context.push('/groups/$groupId/events/new')
                        : null,
                    actionLabel: isAdmin ? 'Create event' : null,
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
                  itemCount: events.length,
                  itemBuilder: (ctx, i) {
                    final e = events[i];
                    final local = e.startTime.toLocal();
                    final isPast = !e.startTime.isAfter(now);
                    return GestureDetector(
                      onTap: () => context.push('/events/${e.id}'),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        decoration: BoxDecoration(
                          color: AppThemeTokens.darkCard,
                          borderRadius:
                              BorderRadius.circular(AppThemeTokens.radiusMd),
                          border:
                              Border.all(color: AppThemeTokens.darkBorder),
                        ),
                        child: Row(
                          children: [
                            // Colored date strip
                            Container(
                              width: 60,
                              padding:
                                  const EdgeInsets.symmetric(vertical: 18),
                              decoration: BoxDecoration(
                                color: isPast
                                    ? AppThemeTokens.darkCardElevated
                                    : AppThemeTokens.primaryGlow,
                                borderRadius: const BorderRadius.only(
                                  topLeft: Radius.circular(
                                      AppThemeTokens.radiusMd),
                                  bottomLeft: Radius.circular(
                                      AppThemeTokens.radiusMd),
                                ),
                                border: const Border(
                                  right: BorderSide(
                                      color: AppThemeTokens.darkBorder),
                                ),
                              ),
                              child: Column(
                                mainAxisAlignment:
                                    MainAxisAlignment.center,
                                children: [
                                  Text(
                                    DateFormat('MMM')
                                        .format(local)
                                        .toUpperCase(),
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.5,
                                      color: isPast
                                          ? AppThemeTokens.darkTextMuted
                                          : AppThemeTokens.primary400,
                                    ),
                                  ),
                                  Text(
                                    DateFormat('d').format(local),
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 20,
                                      color: isPast
                                          ? AppThemeTokens.darkTextSecondary
                                          : AppThemeTokens.primary400,
                                    ),
                                  ),
                                  Text(
                                    DateFormat('EEE')
                                        .format(local)
                                        .toUpperCase(),
                                    style: TextStyle(
                                      fontSize: 8,
                                      letterSpacing: 0.3,
                                      color: isPast
                                          ? AppThemeTokens.darkTextMuted
                                          : AppThemeTokens
                                              .darkTextSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Event info
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 10),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      e.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 14,
                                        color: AppThemeTokens.darkText,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      DateFormat('EEE, MMM d · h:mm a')
                                          .format(local),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppThemeTokens
                                            .darkTextSecondary,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 4,
                                      children: [
                                        if (e.eventType != null)
                                          _EventBadge(
                                              label: e.eventType!),
                                        _EventBadge(
                                          label: e.isPublic
                                              ? 'Public'
                                              : 'Private',
                                          icon: e.isPublic
                                              ? Icons.public_outlined
                                              : Icons.lock_outline,
                                        ),
                                        _EventBadge(
                                          label: e.maxPlayers != null
                                              ? '${e.participantCount}/${e.maxPlayers}'
                                              : '${e.participantCount} joined',
                                          icon: Icons.people_outline,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const Padding(
                              padding: EdgeInsets.only(right: 12),
                              child: Icon(
                                Icons.chevron_right,
                                color: AppThemeTokens.darkTextMuted,
                                size: 18,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
          if (isAdmin)
            Positioned(
              bottom: 16,
              right: 16,
              child: FloatingActionButton(
                onPressed: () => context.push('/groups/$groupId/events/new'),
                tooltip: 'Create event',
                child: const Icon(Icons.add),
              ),
            ),
        ],
      ),
    );
  }
}

class _EventBadge extends StatelessWidget {
  const _EventBadge({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCardElevated,
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

// ---------------------------------------------------------------------------
// Chat tab
// ---------------------------------------------------------------------------

class _ChatTab extends ConsumerStatefulWidget {
  const _ChatTab({required this.groupId, required this.currentUserId});
  final String groupId;
  final String currentUserId;

  @override
  ConsumerState<_ChatTab> createState() => _ChatTabState();
}

class _ChatTabState extends ConsumerState<_ChatTab> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  bool _sending = false;

  @override
  void dispose() {
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref.read(chatNotifierProvider(widget.groupId).notifier).send(text);
      _msgCtrl.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollCtrl.hasClients) {
          _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent,
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeOut);
        }
      });
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final chatAsync = ref.watch(chatNotifierProvider(widget.groupId));
    final theme = Theme.of(context);

    return Column(
      children: [
        Expanded(
          child: chatAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => ErrorDisplay(
              message: e.toString(),
              onRetry: () => ref
                  .read(chatNotifierProvider(widget.groupId).notifier)
                  .load(),
            ),
            data: (messages) {
              if (messages.isEmpty) {
                return const Center(
                  child: Text('No messages yet. Be the first!',
                      style:
                          TextStyle(color: AppThemeTokens.darkTextSecondary)),
                );
              }
              return RefreshIndicator(
                onRefresh: () => ref
                    .read(chatNotifierProvider(widget.groupId).notifier)
                    .refresh(),
                child: ListView.builder(
                  controller: _scrollCtrl,
                  padding:
                      const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                  itemCount: messages.length,
                  itemBuilder: (ctx, i) {
                    final msg = messages[i];
                    final isMe = msg.senderId == widget.currentUserId;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        mainAxisAlignment: isMe
                            ? MainAxisAlignment.end
                            : MainAxisAlignment.start,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (!isMe) ...[
                            UserAvatar(
                                name: msg.senderName,
                                imageUrl: msg.senderPicture,
                                radius: 16),
                            const SizedBox(width: 8),
                          ],
                          Flexible(
                            child: Column(
                              crossAxisAlignment: isMe
                                  ? CrossAxisAlignment.end
                                  : CrossAxisAlignment.start,
                              children: [
                                if (!isMe)
                                  Text(msg.senderName,
                                      style: theme.textTheme.labelSmall
                                          ?.copyWith(
                                              color: AppThemeTokens
                                                  .darkTextSecondary)),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: isMe
                                        ? theme.colorScheme.primary
                                        : AppThemeTokens.darkCardElevated,
                                    borderRadius: BorderRadius.only(
                                      topLeft: const Radius.circular(16),
                                      topRight: const Radius.circular(16),
                                      bottomLeft:
                                          Radius.circular(isMe ? 16 : 4),
                                      bottomRight:
                                          Radius.circular(isMe ? 4 : 16),
                                    ),
                                  ),
                                  child: Text(msg.content,
                                      style: TextStyle(
                                          color: isMe
                                              ? Colors.white
                                              : AppThemeTokens.darkText)),
                                ),
                                Text(
                                  DateFormat('h:mm a')
                                      .format(msg.createdAt.toLocal()),
                                  style: theme.textTheme.labelSmall?.copyWith(
                                      color: AppThemeTokens.darkTextSecondary),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ),
        Container(
          padding: EdgeInsets.fromLTRB(
              12, 8, 12, MediaQuery.of(context).viewInsets.bottom + 8),
          decoration: const BoxDecoration(
            color: AppThemeTokens.darkCard,
            border: Border(
                top: BorderSide(color: AppThemeTokens.darkBorder)),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _msgCtrl,
                  decoration: InputDecoration(
                    hintText: 'Message\u2026',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24)),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  ),
                  textCapitalization: TextCapitalization.sentences,
                  maxLines: 3,
                  minLines: 1,
                  onSubmitted: (_) => _send(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: _sending ? null : _send,
                icon: _sending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

class _HeroPill extends StatelessWidget {
  const _HeroPill({required this.label, required this.color, this.icon});

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCardElevated,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
        border: Border.all(color: AppThemeTokens.darkBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppThemeTokens.primary400),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: AppThemeTokens.darkTextSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
