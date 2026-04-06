import '../../../core/models/chat_model.dart';
import '../../../core/models/extended_models.dart';
import '../../../core/models/group_model.dart';

abstract class GroupRepository {
  Future<List<GroupModel>> getGroups();
  Future<GroupModel> getGroup(String id);
  Future<GroupModel> createGroup(Map<String, dynamic> data);
  Future<GroupModel> updateGroup(String id, Map<String, dynamic> data);
  Future<void> deleteGroup(String id);
  Future<void> leaveGroup(String id);
  Future<void> requestJoinGroup(String id);
  Future<List<JoinRequestModel>> getJoinRequests(String id);
  Future<void> handleJoinRequest(String groupId, String requestId, String action);
  Future<void> removeMember(String groupId, String userId);
  Future<void> updateMemberRole(String groupId, String memberId, String role);
  Future<void> transferAdmin(String groupId, String newAdminId);
  Future<List<GroupModel>> getPublicGroups({double? latitude, double? longitude, double? radius});
  Future<List<NearbyGroupModel>> getNearbyGroups({
    required double latitude,
    required double longitude,
    double? radius,
    int? limit,
  });
  Future<String> getInviteLink(String groupId);
  Future<void> joinGroupByInvite(String groupId);
  Future<List<ChatMessageModel>> getChatMessages(String groupId, {int page = 1});
  Future<void> sendChatMessage(String groupId, String content);
  Future<InviteAnalyticsModel> getGroupInviteAnalytics(String groupId);
}
