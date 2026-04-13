import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/attendance_model.dart';
import '../../../core/models/session_model.dart';
import '../../../core/models/extended_models.dart';
import '../../../core/network/api_client.dart';
import '../domain/session_repository.dart';

class SessionRepositoryImpl implements SessionRepository {
  SessionRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<(List<SessionModel>, String?)> getEvents(
      {String? groupId, String? cursor, int limit = 50}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/sessions',
      queryParameters: {
        if (groupId != null) 'groupId': groupId,
        'limit': limit.toString(),
        if (cursor != null) 'cursor': cursor,
      },
    );

    final data = response.data!;
    final items = data['data'] as List<dynamic>? ?? (data is List ? data as List<dynamic> : []);
    final sessions = items
        .map((e) => SessionModel.fromJson(e as Map<String, dynamic>))
        .toList();

    final pagination = data['pagination'] as Map<String, dynamic>?;
    final nextCursor = pagination?['nextCursor'] as String?;

    return (sessions, nextCursor);
  }

  @override
  Future<SessionModel> getEvent(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/sessions/$id');
    return SessionModel.fromJson(response.data!);
  }

  @override
  Future<SessionModel> getEventByInviteToken(String token) async {
    final response =
        await _dio.get<Map<String, dynamic>>('/sessions/invite/$token');
    return SessionModel.fromJson(response.data!);
  }

  @override
  Future<void> joinEvent(String id) async {
    await _dio.post<void>('/sessions/$id/join');
  }

  @override
  Future<void> joinEventAsGuest(String token, String name) async {
    await _dio.post<void>(
      '/sessions/invite/$token/join',
      data: {'name': name},
    );
  }

  @override
  Future<void> leaveEvent(String id) async {
    await _dio.delete<void>('/sessions/$id/leave');
  }

  @override
  Future<SessionModel> createEvent(Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>('/sessions', data: data);
    return SessionModel.fromJson(response.data!);
  }

  @override
  Future<SessionModel> updateEvent(String id, Map<String, dynamic> data) async {
    final response = await _dio.put<Map<String, dynamic>>('/sessions/$id', data: data);
    return SessionModel.fromJson(response.data!);
  }

  @override
  Future<void> deleteEvent(String id) async {
    await _dio.delete<void>('/sessions/$id');
  }

  @override
  Future<void> markLate(String eventId) async {
    await _dio.post<void>('/chat/event/late', data: {'eventId': eventId});
  }

  @override
  Future<void> unmarkLate(String eventId) async {
    await _dio.post<void>('/chat/event/unmark-late', data: {'eventId': eventId});
  }

  @override
  Future<List<ActivityEntryModel>> getActivityFeed(String eventId) async {
    final response = await _dio.get<dynamic>('/sessions/$eventId/activity');
    final data = response.data;
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['activity'] as List<dynamic>? ??
          data['feed'] as List<dynamic>? ??
          [];
    } else {
      items = [];
    }
    return items
        .map((e) => ActivityEntryModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<String> generateInviteToken(String eventId) async {
    final response = await _dio
        .post<Map<String, dynamic>>('/sessions/$eventId/generate-invite');
    return response.data?['inviteToken'] as String? ??
        response.data?['token'] as String? ??
        '';
  }

  // ---------------------------------------------------------------------------
  // Attendance
  // ---------------------------------------------------------------------------

  @override
  Future<List<AttendanceModel>> getAttendance(String eventId) async {
    final response =
        await _dio.get<Map<String, dynamic>>('/sessions/$eventId/attendance');
    final items = response.data?['attendance'] as List<dynamic>? ?? [];
    return items
        .map((e) => AttendanceModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<AttendanceStatsModel> getAttendanceStats(String eventId) async {
    final response = await _dio
        .get<Map<String, dynamic>>('/sessions/$eventId/attendance/stats');
    return AttendanceStatsModel.fromJson(response.data!);
  }

  @override
  Future<void> markAttendance(String eventId, String status) async {
    await _dio.post<void>(
      '/sessions/$eventId/attendance',
      data: {'status': status},
    );
  }

  @override
  Future<void> deleteAttendance(String eventId, String userId) async {
    await _dio.delete<void>('/sessions/$eventId/attendance/$userId');
  }

  // ---------------------------------------------------------------------------
  // Archive
  // ---------------------------------------------------------------------------

  @override
  Future<void> archiveEvent(String id) async {
    await _dio.post<void>('/sessions/$id/archive');
  }

  @override
  Future<void> unarchiveEvent(String id) async {
    await _dio.post<void>('/sessions/$id/unarchive');
  }

  // ---------------------------------------------------------------------------
  // Participants & Guests
  // ---------------------------------------------------------------------------

  @override
  Future<(List<SessionParticipantDetailModel>, ParticipantSummaryModel)>
      getParticipants(String eventId, {String? status}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/sessions/$eventId/participants',
      queryParameters: {
        if (status != null) 'status': status,
      },
    );
    final data = response.data!;
    final items = (data['participants'] as List<dynamic>? ?? [])
        .map((e) =>
            SessionParticipantDetailModel.fromJson(e as Map<String, dynamic>))
        .toList();
    final summary = data['summary'] != null
        ? ParticipantSummaryModel.fromJson(
            data['summary'] as Map<String, dynamic>)
        : ParticipantSummaryModel(
            total: items.length,
            filtered: items.length,
            confirmed: items.where((p) => p.status == 'confirmed').length,
            pending: items.where((p) => p.status == 'pending').length,
            declined: items.where((p) => p.status == 'declined').length,
            invited: items.where((p) => p.status == 'invited').length,
          );
    return (items, summary);
  }

  @override
  Future<(List<SessionGuestModel>, ParticipantSummaryModel)> getGuests(
      String eventId, {String? status}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/sessions/$eventId/guests',
      queryParameters: {
        if (status != null) 'status': status,
      },
    );
    final data = response.data!;
    final items = (data['guestParticipants'] as List<dynamic>? ?? [])
        .map((e) => SessionGuestModel.fromJson(e as Map<String, dynamic>))
        .toList();
    final summary = data['summary'] != null
        ? ParticipantSummaryModel.fromJson(
            data['summary'] as Map<String, dynamic>)
        : ParticipantSummaryModel(
            total: items.length,
            filtered: items.length,
            confirmed: items.where((g) => g.status == 'confirmed').length,
            pending: items.where((g) => g.status == 'pending').length,
            declined: items.where((g) => g.status == 'declined').length,
            invited: items.where((g) => g.status == 'invited').length,
          );
    return (items, summary);
  }

  // ---------------------------------------------------------------------------
  // Statistics & Analytics
  // ---------------------------------------------------------------------------

  @override
  Future<SessionStatisticsModel> getEventStatistics() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/sessions/statistics');
    return SessionStatisticsModel.fromJson(response.data!);
  }

  @override
  Future<InviteAnalyticsModel> getEventInviteAnalytics(String eventId) async {
    final response = await _dio
        .get<Map<String, dynamic>>('/sessions/$eventId/invitations/analytics');
    return InviteAnalyticsModel.fromJson(response.data!);
  }

  // ---------------------------------------------------------------------------
  // Nearby
  // ---------------------------------------------------------------------------

  @override
  Future<List<NearbySessionModel>> getNearbyEvents({
    required double latitude,
    required double longitude,
    double radius = 25.0,
  }) async {
    final response = await _dio.get<dynamic>(
      '/sessions/nearby',
      queryParameters: {
        'latitude': latitude,
        'longitude': longitude,
        'radius': radius,
      },
    );
    final data = response.data;
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['events'] as List<dynamic>? ??
          data['data'] as List<dynamic>? ??
          [];
    } else {
      items = [];
    }
    return items
        .map((e) => NearbySessionModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final sessionRepositoryProvider = Provider<SessionRepository>((ref) {
  return SessionRepositoryImpl(ref.watch(dioProvider));
});
