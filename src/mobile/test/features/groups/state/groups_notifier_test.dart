import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:teamly_mobile/core/models/chat_model.dart';
import 'package:teamly_mobile/core/models/extended_models.dart';
import 'package:teamly_mobile/core/models/group_model.dart';
import 'package:teamly_mobile/features/groups/data/group_repository_impl.dart';
import 'package:teamly_mobile/features/groups/domain/group_repository.dart';
import 'package:teamly_mobile/features/groups/state/groups_notifier.dart';

class _FakeGroupRepository implements GroupRepository {
  _FakeGroupRepository({required this.groupsResponses});

  final List<List<GroupModel>> groupsResponses;
  int getGroupsCalls = 0;

  @override
  Future<List<GroupModel>> getGroups() async {
    final index = getGroupsCalls;
    getGroupsCalls += 1;
    if (index >= groupsResponses.length) {
      return groupsResponses.last;
    }
    return groupsResponses[index];
  }

  @override
  Future<GroupModel> getGroup(String id) => throw UnimplementedError();

  @override
  Future<GroupModel> createGroup(Map<String, dynamic> data) =>
      throw UnimplementedError();

  @override
  Future<GroupModel> updateGroup(String id, Map<String, dynamic> data) =>
      throw UnimplementedError();

  @override
  Future<void> deleteGroup(String id) => throw UnimplementedError();

  @override
  Future<void> leaveGroup(String id) => throw UnimplementedError();

  @override
  Future<void> requestJoinGroup(String id) => throw UnimplementedError();

  @override
  Future<List<JoinRequestModel>> getJoinRequests(String id) =>
      throw UnimplementedError();

  @override
  Future<void> handleJoinRequest(
          String groupId, String requestId, String action) =>
      throw UnimplementedError();

  @override
  Future<void> removeMember(String groupId, String userId) =>
      throw UnimplementedError();

  @override
  Future<void> updateMemberRole(
          String groupId, String memberId, String role) =>
      throw UnimplementedError();

  @override
  Future<void> transferAdmin(String groupId, String newAdminId) =>
      throw UnimplementedError();

  @override
  Future<List<GroupModel>> getPublicGroups(
          {double? latitude, double? longitude, double? radius}) =>
      throw UnimplementedError();

  @override
  Future<(List<GroupModel>, String?)> getPublicGroupsPaginated(
          {String? cursor, int limit = 20}) =>
      throw UnimplementedError();

  @override
  Future<List<NearbyGroupModel>> getNearbyGroups({
    required double latitude,
    required double longitude,
    double? radius,
    int? limit,
  }) =>
      throw UnimplementedError();

  @override
  Future<String> getInviteLink(String groupId) => throw UnimplementedError();

  @override
  Future<void> joinGroupByInvite(String groupId) =>
      throw UnimplementedError();

  @override
  Future<List<ChatMessageModel>> getChatMessages(String groupId,
          {int page = 1}) =>
      throw UnimplementedError();

  @override
  Future<void> sendChatMessage(String groupId, String content) =>
      throw UnimplementedError();

  @override
  Future<InviteAnalyticsModel> getGroupInviteAnalytics(String groupId) =>
      throw UnimplementedError();

  @override
  Future<void> inviteMember(String groupId, String email) =>
      throw UnimplementedError();

  @override
  Future<String> uploadGroupPicture(String groupId, String filePath) =>
      throw UnimplementedError();

  @override
  Future<void> deleteGroupPicture(String groupId) =>
      throw UnimplementedError();

  @override
  Future<List<GroupInvitationModel>> getUserInvitations() =>
      throw UnimplementedError();

  @override
  Future<List<UserJoinRequestModel>> getMyJoinRequests() =>
      throw UnimplementedError();

  @override
  Future<void> respondToInvitation(
          String groupId, String requestId, String action) =>
      throw UnimplementedError();

  @override
  Future<void> cancelJoinRequest(String groupId, String requestId) =>
      throw UnimplementedError();
}

GroupModel _group(String id, String name) {
  return GroupModel(
    id: id,
    name: name,
    isPublic: true,
    createdAt: DateTime.utc(2026, 1, 1),
  );
}

void main() {
  test('loads groups on build', () async {
    final first = _group('g1', 'Sunday League');
    final fakeRepo = _FakeGroupRepository(groupsResponses: [
      [first],
    ]);

    final container = ProviderContainer(
      overrides: [groupRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    final result = await container.read(groupsNotifierProvider.future);

    expect(result, [first]);
    expect(fakeRepo.getGroupsCalls, 1);
  });

  test('reload refreshes the group list from the repository', () async {
    final first = _group('g1', 'Sunday League');
    final second = _group('g2', 'Weekday Futsal');
    final fakeRepo = _FakeGroupRepository(groupsResponses: [
      [first],
      [first, second],
    ]);

    final container = ProviderContainer(
      overrides: [groupRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container.read(groupsNotifierProvider.future);
    await container.read(groupsNotifierProvider.notifier).reload();

    expect(
      container.read(groupsNotifierProvider).requireValue,
      [first, second],
    );
    expect(fakeRepo.getGroupsCalls, 2);
  });
}
