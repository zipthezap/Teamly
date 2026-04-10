import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/chat_model.dart';
import '../../../core/models/extended_models.dart';
import '../../../core/models/group_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/group_repository.dart';

class GroupRepositoryImpl implements GroupRepository {
  GroupRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<GroupModel>> getGroups() async {
    final response = await _dio.get<List<dynamic>>('/groups');
    return (response.data ?? [])
        .map((e) => GroupModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<GroupModel> getGroup(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/groups/$id');
    return GroupModel.fromJson(response.data!);
  }

  @override
  Future<GroupModel> createGroup(Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>('/groups', data: data);
    return GroupModel.fromJson(response.data!);
  }

  @override
  Future<GroupModel> updateGroup(String id, Map<String, dynamic> data) async {
    final response = await _dio.put<Map<String, dynamic>>('/groups/$id', data: data);
    return GroupModel.fromJson(response.data!);
  }

  @override
  Future<void> deleteGroup(String id) async {
    await _dio.delete<void>('/groups/$id');
  }

  @override
  Future<void> leaveGroup(String id) async {
    await _dio.delete<void>('/groups/$id/leave');
  }

  @override
  Future<void> requestJoinGroup(String id) async {
    await _dio.post<void>('/groups/$id/join-request');
  }

  @override
  Future<List<JoinRequestModel>> getJoinRequests(String id) async {
    final response = await _dio.get<dynamic>('/groups/$id/join-requests');
    final data = response.data;
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['joinRequests'] as List<dynamic>? ??
          data['requests'] as List<dynamic>? ??
          [];
    } else {
      items = [];
    }
    return items
        .map((e) => JoinRequestModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> handleJoinRequest(
      String groupId, String requestId, String action) async {
    await _dio.post<void>(
      '/groups/$groupId/join-requests/$requestId',
      data: {'action': action},
    );
  }

  @override
  Future<void> removeMember(String groupId, String userId) async {
    await _dio.delete<void>('/groups/$groupId/members/user/$userId');
  }

  @override
  Future<void> updateMemberRole(
      String groupId, String memberId, String role) async {
    await _dio.put<void>(
      '/groups/$groupId/members/$memberId/role',
      data: {'role': role},
    );
  }

  @override
  Future<void> transferAdmin(String groupId, String newAdminId) async {
    await _dio.post<void>(
      '/groups/$groupId/transfer-admin',
      data: {'newAdminId': newAdminId},
    );
  }

  @override
  Future<List<GroupModel>> getPublicGroups({
    double? latitude,
    double? longitude,
    double? radius,
  }) async {
    final response = await _dio.get<dynamic>(
      '/groups/public',
      queryParameters: {
        if (latitude != null) 'latitude': latitude.toString(),
        if (longitude != null) 'longitude': longitude.toString(),
        if (radius != null) 'radius': radius.toString(),
      },
    );
    final data = response.data;
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['groups'] as List<dynamic>? ?? [];
    } else {
      items = [];
    }
    return items
        .map((e) => GroupModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<String> getInviteLink(String groupId) async {
    final response =
        await _dio.get<Map<String, dynamic>>('/groups/$groupId/invite-link');
    return response.data?['inviteLink'] as String? ??
        response.data?['link'] as String? ??
        '';
  }

  @override
  Future<void> joinGroupByInvite(String groupId) async {
    await _dio.post<void>('/groups/join/$groupId');
  }

  @override
  Future<List<ChatMessageModel>> getChatMessages(String groupId,
      {int page = 1}) async {
    final response = await _dio.get<dynamic>(
      '/chat/$groupId/messages',
      queryParameters: {'page': page.toString(), 'limit': '50'},
    );
    final data = response.data;
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['messages'] as List<dynamic>? ?? [];
    } else {
      items = [];
    }
    return items
        .map((e) => ChatMessageModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> sendChatMessage(String groupId, String content) async {
    await _dio.post<void>(
      '/chat/message',
      data: {'groupId': groupId, 'content': content},
    );
  }

  @override
  Future<List<NearbyGroupModel>> getNearbyGroups({
    required double latitude,
    required double longitude,
    double? radius,
    int? limit,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/groups/nearby',
      queryParameters: {
        'latitude': latitude.toString(),
        'longitude': longitude.toString(),
        if (radius != null) 'radius': radius.toString(),
        if (limit != null) 'limit': limit.toString(),
      },
    );
    final data = response.data!;
    final items = data['results'] as List<dynamic>? ?? [];
    return items
        .map((e) => NearbyGroupModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<InviteAnalyticsModel> getGroupInviteAnalytics(String groupId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/groups/$groupId/invitations/analytics',
    );
    return InviteAnalyticsModel.fromJson(response.data!);
  }

  @override
  Future<void> inviteMember(String groupId, String email) async {
    await _dio.post<void>(
      '/groups/$groupId/invite',
      data: {'email': email},
    );
  }

  @override
  Future<String> uploadGroupPicture(String groupId, String filePath) async {
    final formData = FormData.fromMap({
      'groupPicture': await MultipartFile.fromFile(filePath),
    });
    final response = await _dio.post<Map<String, dynamic>>(
      '/groups/$groupId/picture',
      data: formData,
    );
    return response.data?['profilePicture'] as String? ?? '';
  }

  @override
  Future<void> deleteGroupPicture(String groupId) async {
    await _dio.delete<void>('/groups/$groupId/picture');
  }

  @override
  Future<List<GroupInvitationModel>> getUserInvitations() async {
    final response = await _dio.get<dynamic>('/groups/invitations/pending');
    final data = response.data;
    final List<dynamic> items = data is List ? data : [];
    return items
        .map((e) => GroupInvitationModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<UserJoinRequestModel>> getMyJoinRequests() async {
    final response = await _dio.get<dynamic>('/groups/my-join-requests');
    final data = response.data;
    final List<dynamic> items = data is List ? data : [];
    return items
        .map((e) => UserJoinRequestModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> respondToInvitation(
      String groupId, String requestId, String action) async {
    await _dio.post<void>(
      '/groups/$groupId/invitations/$requestId/respond',
      data: {'action': action},
    );
  }

  @override
  Future<void> cancelJoinRequest(String groupId, String requestId) async {
    await _dio.delete<void>('/groups/$groupId/join-requests/$requestId');
  }
}

final groupRepositoryProvider = Provider<GroupRepository>((ref) {
  return GroupRepositoryImpl(ref.watch(dioProvider));
});
