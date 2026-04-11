import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/chat_model.dart';
import '../../../core/models/group_model.dart';
import '../data/group_repository_impl.dart';
import '../domain/group_repository.dart';

// ---------------------------------------------------------------------------
// Groups list
// ---------------------------------------------------------------------------

/// Riverpod 2.x [AsyncNotifier] for the authenticated user's group list.
///
/// Replaces the deprecated `StateNotifier<AsyncValue<T>>` pattern.
/// Consumers watch [groupsNotifierProvider] and receive [AsyncValue<List<GroupModel>>].
class GroupsNotifier extends AsyncNotifier<List<GroupModel>> {
  @override
  Future<List<GroupModel>> build() {
    return ref.watch(groupRepositoryProvider).getGroups();
  }

  /// Imperatively reload the group list (e.g. after creating / leaving a group).
  Future<void> reload() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(groupRepositoryProvider).getGroups(),
    );
  }
}

final groupsNotifierProvider =
    AsyncNotifierProvider<GroupsNotifier, List<GroupModel>>(GroupsNotifier.new);

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

/// Riverpod 2.x [FamilyAsyncNotifier] for chat messages in a group.
///
/// The family argument [arg] is the groupId.
class ChatNotifier extends FamilyAsyncNotifier<List<ChatMessageModel>, String> {
  @override
  Future<List<ChatMessageModel>> build(String groupId) {
    return ref.watch(groupRepositoryProvider).getChatMessages(groupId);
  }

  /// Reload messages from the server.
  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(groupRepositoryProvider).getChatMessages(arg),
    );
  }

  /// Send a message then refresh the list.
  Future<void> send(String content) async {
    await ref.read(groupRepositoryProvider).sendChatMessage(arg, content);
    await refresh();
  }
}

final chatNotifierProvider = AsyncNotifierProvider.family<ChatNotifier,
    List<ChatMessageModel>, String>(ChatNotifier.new);

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

