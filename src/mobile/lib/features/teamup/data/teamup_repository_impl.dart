import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/teamup_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/teamup_repository.dart';

class TeamUpRepositoryImpl implements TeamUpRepository {
  TeamUpRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<TeamUpBrowseResult> getRequests({
    String? sportType,
    String? requestType,
    String? skillLevel,
    String? city,
    String? search,
    String? fromDate,
    String? toDate,
    String? cursor,
  }) async {
    final response = await _dio.get<dynamic>(
      '/teamup',
      queryParameters: {
        if (sportType != null && sportType.isNotEmpty) 'sportType': sportType,
        if (requestType != null && requestType.isNotEmpty)
          'requestType': requestType,
        if (skillLevel != null && skillLevel.isNotEmpty)
          'skillLevel': skillLevel,
        if (city != null && city.isNotEmpty) 'city': city,
        if (search != null && search.isNotEmpty) 'search': search,
        if (fromDate != null) 'fromDate': fromDate,
        if (toDate != null) 'toDate': toDate,
        if (cursor != null) 'cursor': cursor,
        'limit': '50',
      },
    );
    return TeamUpBrowseResult.fromJson(response.data);
  }

  @override
  Future<List<TeamUpRequestModel>> getNearbyRequests({
    required double latitude,
    required double longitude,
    double radiusKm = 10,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/teamup/nearby',
      queryParameters: {
        'latitude': latitude.toString(),
        'longitude': longitude.toString(),
        'radius': radiusKm.toString(),
        'limit': '50',
      },
    );
    final items = response.data?['results'] as List<dynamic>? ?? const [];
    return items
        .map((e) => TeamUpRequestModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TeamUpRequestModel> getRequest(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/teamup/$id');
    return TeamUpRequestModel.fromJson(response.data!);
  }

  @override
  Future<List<TeamUpRequestModel>> getMyRequests() async {
    final response = await _dio.get<dynamic>('/teamup/my-requests');
    return _parseRequestList(response.data);
  }

  @override
  Future<List<TeamUpResponseModel>> getMyResponses() async {
    final response = await _dio.get<dynamic>('/teamup/my-responses');
    return _parseResponseList(response.data);
  }

  @override
  Future<List<TeamUpApplicationModel>> getMyApplications() async {
    final response = await _dio.get<dynamic>('/teamup/my-applications');
    final data = response.data;
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['data'] as List<dynamic>? ?? [];
    } else {
      items = [];
    }
    return items
        .map((e) => TeamUpApplicationModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TeamUpRequestModel> createRequest(Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>('/teamup', data: data);
    return TeamUpRequestModel.fromJson(response.data!);
  }

  @override
  Future<TeamUpRequestModel> updateRequest(
      String id, Map<String, dynamic> data) async {
    final response =
        await _dio.put<Map<String, dynamic>>('/teamup/$id', data: data);
    return TeamUpRequestModel.fromJson(response.data!);
  }

  @override
  Future<void> deleteRequest(String id) async {
    await _dio.delete<void>('/teamup/$id');
  }

  @override
  Future<void> respondToRequest(
    String id,
    String message, {
    String? requestPositionId,
    String? applicantSkillLevel,
  }) async {
    await _dio.post<void>(
      '/teamup/$id/respond',
      data: {
        'message': message,
        if (requestPositionId != null && requestPositionId.isNotEmpty)
          'requestPositionId': requestPositionId,
        if (applicantSkillLevel != null && applicantSkillLevel.isNotEmpty)
          'applicantSkillLevel': applicantSkillLevel,
      },
    );
  }

  @override
  Future<void> handleResponse(
      String requestId, String responseId, String action) async {
    await _dio.post<void>(
      '/teamup/$requestId/responses/$responseId',
      data: {'action': action},
    );
  }

  @override
  Future<void> withdrawResponse(String requestId) async {
    await _dio.delete<void>('/teamup/$requestId/respond');
  }

  @override
  Future<void> updateRsvp(String requestId, String rsvpStatus) async {
    await _dio.put<void>(
      '/teamup/$requestId/respond/rsvp',
      data: {'rsvpStatus': rsvpStatus},
    );
  }

  @override
  Future<List<TeamUpResponseModel>> getRequestResponses(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/teamup/$id');
    final data = response.data!;
    final items = data['responses'] as List<dynamic>? ?? [];
    return items
        .map((e) => TeamUpResponseModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<TeamUpCommentModel>> getComments(String id) async {
    final response = await _dio.get<dynamic>('/teamup/$id/comments');
    final data = response.data;
    final List<dynamic> items = data is List ? data : [];
    return items
        .map((e) => TeamUpCommentModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TeamUpCommentModel> addComment(String id, String content) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/teamup/$id/comments',
      data: {'content': content},
    );
    return TeamUpCommentModel.fromJson(response.data!);
  }

  @override
  Future<void> deleteComment(String requestId, String commentId) async {
    await _dio.delete<void>('/teamup/$requestId/comments/$commentId');
  }

  @override
  Future<void> reportRequest(String requestId, String reason) async {
    await _dio.post<void>(
      '/teamup/$requestId/report',
      data: {'reason': reason},
    );
  }

  // ── New feature methods ──────────────────────────────────────────────────

  @override
  Future<TeamUpAttendanceHistoryModel> getAttendanceHistory() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/teamup/attendance-history');
    return TeamUpAttendanceHistoryModel.fromJson(response.data!);
  }

  @override
  Future<List<TeamUpSavedSearchModel>> listSavedSearches() async {
    final response = await _dio.get<dynamic>('/teamup/saved-searches');
    final data = response.data;
    final List<dynamic> items = data is List ? data : [];
    return items
        .map((e) => TeamUpSavedSearchModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TeamUpSavedSearchModel> createSavedSearch(
      Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/teamup/saved-searches',
      data: data,
    );
    return TeamUpSavedSearchModel.fromJson(response.data!);
  }

  @override
  Future<void> deleteSavedSearch(String searchId) async {
    await _dio.delete<void>('/teamup/saved-searches/$searchId');
  }

  @override
  Future<TeamUpAnalyticsModel> getTeamUpAnalytics(
      {String? fromDate, String? toDate}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/teamup/analytics',
      queryParameters: {
        if (fromDate != null) 'fromDate': fromDate,
        if (toDate != null) 'toDate': toDate,
      },
    );
    return TeamUpAnalyticsModel.fromJson(response.data!);
  }

  @override
  Future<void> markAttendance(
      String requestId, String responseId, String attendanceStatus) async {
    await _dio.put<void>(
      '/teamup/$requestId/responses/$responseId/attendance',
      data: {'attendanceStatus': attendanceStatus},
    );
  }

  @override
  Future<void> bulkHandleResponses(
      String requestId, String action, List<String> responseIds) async {
    await _dio.post<void>(
      '/teamup/$requestId/responses/bulk-handle',
      data: {'action': action, 'responseIds': responseIds},
    );
  }

  @override
  Future<void> sendReminderNudges(String requestId) async {
    await _dio.post<void>('/teamup/$requestId/reminders');
  }

  @override
  Future<List<TeamUpReplacementSuggestionModel>> getReplacementSuggestions(
      String requestId, {String? requestPositionId}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/teamup/$requestId/replacements/suggestions',
      queryParameters: {
        if (requestPositionId != null) 'requestPositionId': requestPositionId,
      },
    );
    final items =
        response.data?['data'] as List<dynamic>? ?? const [];
    return items
        .map((e) => TeamUpReplacementSuggestionModel.fromJson(
            e as Map<String, dynamic>))
        .toList();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  List<TeamUpRequestModel> _parseRequestList(dynamic data) {
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['data'] as List<dynamic>? ??
          data['requests'] as List<dynamic>? ??
          [];
    } else {
      items = [];
    }
    return items
        .map((e) => TeamUpRequestModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  List<TeamUpResponseModel> _parseResponseList(dynamic data) {
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      // Handle both paginated format ({data: [...]}) and legacy ({responses: [...]})
      items = data['data'] as List<dynamic>? ??
          data['responses'] as List<dynamic>? ??
          [];
    } else {
      items = [];
    }
    return items
        .map((e) => TeamUpResponseModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final teamUpRepositoryProvider = Provider<TeamUpRepository>((ref) {
  return TeamUpRepositoryImpl(ref.watch(dioProvider));
});
