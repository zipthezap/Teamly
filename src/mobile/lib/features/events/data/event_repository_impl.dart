import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/event_model.dart';
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
  Future<void> joinEvent(String id) async {
    await _dio.post<void>('/events/$id/join');
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
}

final eventRepositoryProvider = Provider<EventRepository>((ref) {
  return EventRepositoryImpl(ref.watch(dioProvider));
});
