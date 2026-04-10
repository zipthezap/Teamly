import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/chat_model.dart';
import '../../../core/models/group_model.dart';
import '../data/group_repository_impl.dart';
import '../domain/group_repository.dart';

// ---------------------------------------------------------------------------
// Groups list
// ---------------------------------------------------------------------------

class GroupsNotifier extends StateNotifier<AsyncValue<List<GroupModel>>> {
  GroupsNotifier(this._repo) : super(const AsyncValue.loading()) {
    load();
  }

  final GroupRepository _repo;

  Future<void> load() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repo.getGroups());
  }
}

final groupsNotifierProvider =
    StateNotifierProvider<GroupsNotifier, AsyncValue<List<GroupModel>>>((ref) {
  return GroupsNotifier(ref.watch(groupRepositoryProvider));
});

// ---------------------------------------------------------------------------
// Single group detail
// ---------------------------------------------------------------------------

final groupDetailProvider = FutureProvider.family<GroupModel, String>((ref, id) async {
  return ref.watch(groupRepositoryProvider).getGroup(id);
});

// ---------------------------------------------------------------------------
// Join requests for a group
// ---------------------------------------------------------------------------

final joinRequestsProvider =
    FutureProvider.family<List<JoinRequestModel>, String>((ref, groupId) async {
  return ref.watch(groupRepositoryProvider).getJoinRequests(groupId);
});

// ---------------------------------------------------------------------------
// Group chat messages
// ---------------------------------------------------------------------------

class ChatNotifier extends StateNotifier<AsyncValue<List<ChatMessageModel>>> {
  ChatNotifier(this._repo, this._groupId) : super(const AsyncValue.loading()) {
    load();
  }

  final GroupRepository _repo;
  final String _groupId;

  Future<void> load() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repo.getChatMessages(_groupId));
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(() => _repo.getChatMessages(_groupId));
  }

  Future<void> send(String content) async {
    await _repo.sendChatMessage(_groupId, content);
    await refresh();
  }
}

final chatNotifierProvider = StateNotifierProvider.family<ChatNotifier,
    AsyncValue<List<ChatMessageModel>>, String>(
  (ref, groupId) =>
      ChatNotifier(ref.watch(groupRepositoryProvider), groupId),
);

// ---------------------------------------------------------------------------
// Public groups discovery
// ---------------------------------------------------------------------------

final publicGroupsProvider =
    FutureProvider<List<GroupModel>>((ref) async {
  return ref.watch(groupRepositoryProvider).getPublicGroups();
});

// ---------------------------------------------------------------------------
// User's pending invitations (admin invited this user)
// ---------------------------------------------------------------------------

final userInvitationsProvider =
    FutureProvider<List<GroupInvitationModel>>((ref) async {
  return ref.watch(groupRepositoryProvider).getUserInvitations();
});

// ---------------------------------------------------------------------------
// User's own pending join requests
// ---------------------------------------------------------------------------

final myJoinRequestsProvider =
    FutureProvider<List<UserJoinRequestModel>>((ref) async {
  return ref.watch(groupRepositoryProvider).getMyJoinRequests();
});
