import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/group_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../data/group_repository_impl.dart';
import '../state/groups_notifier.dart';

class GroupRequestsPage extends ConsumerStatefulWidget {
  const GroupRequestsPage({super.key});

  @override
  ConsumerState<GroupRequestsPage> createState() => _GroupRequestsPageState();
}

class _GroupRequestsPageState extends ConsumerState<GroupRequestsPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Requests & Invites'),
        bottom: TabBar(
          controller: _tabCtrl,
          indicatorColor: AppThemeTokens.primary500,
          labelColor: AppThemeTokens.primary400,
          unselectedLabelColor: AppThemeTokens.darkTextSecondary,
          tabs: const [
            Tab(text: 'Invitations'),
            Tab(text: 'My Requests'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: const [
          _InvitationsTab(),
          _MyRequestsTab(),
        ],
      ),
    );
  }
}

// ── Invitations tab ───────────────────────────────────────────────────────────

class _InvitationsTab extends ConsumerStatefulWidget {
  const _InvitationsTab();

  @override
  ConsumerState<_InvitationsTab> createState() => _InvitationsTabState();
}

class _InvitationsTabState extends ConsumerState<_InvitationsTab> {
  final Map<String, bool> _responding = {};

  String _extractMsg(Exception e) {
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _respond(GroupInvitationModel inv, String action) async {
    setState(() => _responding[inv.id] = true);
    try {
      await ref
          .read(groupRepositoryProvider)
          .respondToInvitation(inv.groupId, inv.id, action);
      ref.invalidate(userInvitationsProvider);
      if (action == 'accept') {
        ref.read(groupsNotifierProvider.notifier).reload();
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              action == 'accept'
                  ? 'Joined "${inv.groupName}"!'
                  : 'Invitation declined.',
            ),
          ),
        );
        if (action == 'accept') {
          context.push('/groups/${inv.groupId}');
        }
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
      if (mounted) setState(() => _responding[inv.id] = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final invitationsAsync = ref.watch(userInvitationsProvider);

    return invitationsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorDisplay(
        message: e.toString(),
        onRetry: () => ref.invalidate(userInvitationsProvider),
      ),
      data: (invitations) {
        if (invitations.isEmpty) {
          return const UiEmptyState(
            icon: Icons.mail_outline_rounded,
            title: 'No invitations',
            message: 'You have no pending group invitations.',
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(userInvitationsProvider),
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: invitations.length,
            itemBuilder: (context, i) {
              final inv = invitations[i];
              final responding = _responding[inv.id] == true;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _InvitationCard(
                  invitation: inv,
                  responding: responding,
                  onAccept: () => _respond(inv, 'accept'),
                  onDecline: () => _respond(inv, 'decline'),
                  onView: () => context.push('/groups/${inv.groupId}'),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ── My requests tab ───────────────────────────────────────────────────────────

class _MyRequestsTab extends ConsumerStatefulWidget {
  const _MyRequestsTab();

  @override
  ConsumerState<_MyRequestsTab> createState() => _MyRequestsTabState();
}

class _MyRequestsTabState extends ConsumerState<_MyRequestsTab> {
  final Map<String, bool> _cancelling = {};

  String _extractMsg(Exception e) {
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _cancel(UserJoinRequestModel req) async {
    setState(() => _cancelling[req.id] = true);
    try {
      await ref
          .read(groupRepositoryProvider)
          .cancelJoinRequest(req.groupId, req.id);
      ref.invalidate(myJoinRequestsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Request to "${req.groupName}" cancelled.')),
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
      if (mounted) setState(() => _cancelling[req.id] = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(myJoinRequestsProvider);

    return requestsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorDisplay(
        message: e.toString(),
        onRetry: () => ref.invalidate(myJoinRequestsProvider),
      ),
      data: (requests) {
        if (requests.isEmpty) {
          return const UiEmptyState(
            icon: Icons.how_to_reg_outlined,
            title: 'No pending requests',
            message: 'You have not applied to any groups yet.',
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(myJoinRequestsProvider),
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: requests.length,
            itemBuilder: (context, i) {
              final req = requests[i];
              final cancelling = _cancelling[req.id] == true;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _JoinRequestCard(
                  request: req,
                  cancelling: cancelling,
                  onCancel: () => _cancel(req),
                  onView: () => context.push('/groups/${req.groupId}'),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ── Invitation card ───────────────────────────────────────────────────────────

class _InvitationCard extends StatelessWidget {
  const _InvitationCard({
    required this.invitation,
    required this.responding,
    required this.onAccept,
    required this.onDecline,
    required this.onView,
  });

  final GroupInvitationModel invitation;
  final bool responding;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCard,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
            color: AppThemeTokens.primary500.withValues(alpha: 0.3)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              UserAvatar(
                name: invitation.groupName,
                imageUrl: invitation.groupPicture,
                radius: 22,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      invitation.groupName,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: AppThemeTokens.darkText,
                      ),
                    ),
                    if (invitation.invitedByName != null)
                      Text(
                        'Invited by ${invitation.invitedByName}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppThemeTokens.darkTextSecondary,
                        ),
                      ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppThemeTokens.primary500.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(100),
                ),
                child: const Text(
                  'Invited',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppThemeTokens.primary400,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          if (invitation.groupDescription != null &&
              invitation.groupDescription!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              invitation.groupDescription!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                color: AppThemeTokens.darkTextSecondary,
              ),
            ),
          ],
          const SizedBox(height: 12),
          responding
              ? const Center(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onView,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppThemeTokens.darkTextSecondary,
                          side: const BorderSide(
                              color: AppThemeTokens.darkBorder),
                          padding:
                              const EdgeInsets.symmetric(vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(
                                AppThemeTokens.radiusSm),
                          ),
                        ),
                        child: const Text('View Group',
                            style: TextStyle(fontSize: 13)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onDecline,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppThemeTokens.error,
                          side:
                              const BorderSide(color: AppThemeTokens.error),
                          padding:
                              const EdgeInsets.symmetric(vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(
                                AppThemeTokens.radiusSm),
                          ),
                        ),
                        child: const Text('Decline',
                            style: TextStyle(fontSize: 13)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: onAccept,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppThemeTokens.primary500,
                          foregroundColor: Colors.white,
                          padding:
                              const EdgeInsets.symmetric(vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(
                                AppThemeTokens.radiusSm),
                          ),
                        ),
                        child: const Text('Accept',
                            style: TextStyle(fontSize: 13)),
                      ),
                    ),
                  ],
                ),
        ],
      ),
    );
  }
}

// ── Join request card ─────────────────────────────────────────────────────────

class _JoinRequestCard extends StatelessWidget {
  const _JoinRequestCard({
    required this.request,
    required this.cancelling,
    required this.onCancel,
    required this.onView,
  });

  final UserJoinRequestModel request;
  final bool cancelling;
  final VoidCallback onCancel;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCard,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.darkBorder),
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          UserAvatar(
            name: request.groupName,
            imageUrl: request.groupPicture,
            radius: 22,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  request.groupName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: AppThemeTokens.darkText,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppThemeTokens.warning.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: const Text(
                        'Pending',
                        style: TextStyle(
                          fontSize: 10,
                          color: AppThemeTokens.warning,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          cancelling
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    GestureDetector(
                      onTap: onView,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          border: Border.all(
                              color: AppThemeTokens.primary500),
                          borderRadius: BorderRadius.circular(
                              AppThemeTokens.radiusSm),
                        ),
                        child: const Text(
                          'View',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppThemeTokens.primary400,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: onCancel,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          border: Border.all(
                              color: AppThemeTokens.error
                                  .withValues(alpha: 0.5)),
                          borderRadius: BorderRadius.circular(
                              AppThemeTokens.radiusSm),
                        ),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppThemeTokens.error,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
        ],
      ),
    );
  }
}
