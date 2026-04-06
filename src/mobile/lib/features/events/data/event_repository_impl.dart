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
    // Paginated response: { data: [...], pagination: {...} }
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
}

final eventRepositoryProvider = Provider<EventRepository>((ref) {
  return EventRepositoryImpl(ref.watch(dioProvider));
});
