import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/attendance_model.dart';
import '../../../core/models/event_model.dart';
import '../../../core/models/extended_models.dart';
import '../../../core/network/api_client.dart';
import '../domain/event_repository.dart';

class EventRepositoryImpl implements EventRepository {
  EventRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<EventModel>> getEvents({String? groupId}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/events',
      queryParameters: {
        if (groupId != null) 'groupId': groupId,
        'limit': '50',
      },
    );

    final data = response.data!;
    final items = data['data'] as List<dynamic>? ?? (data is List ? data as List<dynamic> : []);
    return items
        .map((e) => EventModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<EventModel> getEvent(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/events/$id');
    return EventModel.fromJson(response.data!);
  }

  @override
  Future<EventModel> getEventByInviteToken(String token) async {
    final response =
        await _dio.get<Map<String, dynamic>>('/events/invite/$token');
    return EventModel.fromJson(response.data!);
  }

  @override
  Future<void> joinEvent(String id) async {
    await _dio.post<void>('/events/$id/join');
  }

  @override
  Future<void> joinEventAsGuest(String token, String name) async {
    await _dio.post<void>(
      '/events/invite/$token/join',
      data: {'name': name},
    );
  }

  @override
  Future<void> leaveEvent(String id) async {
    await _dio.delete<void>('/events/$id/leave');
  }

  @override
  Future<EventModel> createEvent(Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>('/events', data: data);
    return EventModel.fromJson(response.data!);
  }

  @override
  Future<EventModel> updateEvent(String id, Map<String, dynamic> data) async {
    final response = await _dio.put<Map<String, dynamic>>('/events/$id', data: data);
    return EventModel.fromJson(response.data!);
  }

  @override
  Future<void> deleteEvent(String id) async {
    await _dio.delete<void>('/events/$id');
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
    final response = await _dio.get<dynamic>('/events/$eventId/activity');
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
        .post<Map<String, dynamic>>('/events/$eventId/generate-invite');
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
        await _dio.get<Map<String, dynamic>>('/events/$eventId/attendance');
    final items = response.data?['attendance'] as List<dynamic>? ?? [];
    return items
        .map((e) => AttendanceModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<AttendanceStatsModel> getAttendanceStats(String eventId) async {
    final response = await _dio
        .get<Map<String, dynamic>>('/events/$eventId/attendance/stats');
    return AttendanceStatsModel.fromJson(response.data!);
  }

  @override
  Future<void> markAttendance(String eventId, String status) async {
    await _dio.post<void>(
      '/events/$eventId/attendance',
      data: {'status': status},
    );
  }

  @override
  Future<void> deleteAttendance(String eventId, String userId) async {
    await _dio.delete<void>('/events/$eventId/attendance/$userId');
  }

  // ---------------------------------------------------------------------------
  // Archive
  // ---------------------------------------------------------------------------

  @override
  Future<void> archiveEvent(String id) async {
    await _dio.post<void>('/events/$id/archive');
  }

  @override
  Future<void> unarchiveEvent(String id) async {
    await _dio.post<void>('/events/$id/unarchive');
  }

  // ---------------------------------------------------------------------------
  // Participants & Guests
  // ---------------------------------------------------------------------------

  @override
  Future<(List<EventParticipantDetailModel>, ParticipantSummaryModel)>
      getParticipants(String eventId, {String? status}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/events/$eventId/participants',
      queryParameters: {
        if (status != null) 'status': status,
      },
    );
    final data = response.data!;
    final items = (data['participants'] as List<dynamic>? ?? [])
        .map((e) =>
            EventParticipantDetailModel.fromJson(e as Map<String, dynamic>))
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
  Future<(List<EventGuestModel>, ParticipantSummaryModel)> getGuests(
      String eventId, {String? status}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/events/$eventId/guests',
      queryParameters: {
        if (status != null) 'status': status,
      },
    );
    final data = response.data!;
    final items = (data['guestParticipants'] as List<dynamic>? ?? [])
        .map((e) => EventGuestModel.fromJson(e as Map<String, dynamic>))
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
  Future<EventStatisticsModel> getEventStatistics() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/events/statistics');
    return EventStatisticsModel.fromJson(response.data!);
  }

  @override
  Future<InviteAnalyticsModel> getEventInviteAnalytics(String eventId) async {
    final response = await _dio
        .get<Map<String, dynamic>>('/events/$eventId/invitations/analytics');
    return InviteAnalyticsModel.fromJson(response.data!);
  }

  // ---------------------------------------------------------------------------
  // Nearby
  // ---------------------------------------------------------------------------

  @override
  Future<List<NearbyEventModel>> getNearbyEvents({
    required double latitude,
    required double longitude,
    double radius = 25.0,
  }) async {
    final response = await _dio.get<dynamic>(
      '/events/nearby',
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
        .map((e) => NearbyEventModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final eventRepositoryProvider = Provider<EventRepository>((ref) {
  return EventRepositoryImpl(ref.watch(dioProvider));
});
