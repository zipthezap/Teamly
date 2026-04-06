import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/event_request_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/event_request_repository.dart';

class EventRequestRepositoryImpl implements EventRequestRepository {
  EventRequestRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<EventRequestModel>> getGroupRequests(String groupId) async {
    final response =
        await _dio.get<dynamic>('/event-requests/group/$groupId');
    final data = response.data;
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['requests'] as List<dynamic>? ??
          data['data'] as List<dynamic>? ??
          [];
    } else {
      items = [];
    }
    return items
        .map((e) =>
            EventRequestModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<EventRequestModel> getRequest(String id) async {
    final response =
        await _dio.get<Map<String, dynamic>>('/event-requests/$id');
    final data = response.data!;
    return EventRequestModel.fromJson(
        data['request'] as Map<String, dynamic>? ?? data);
  }

  @override
  Future<EventRequestModel> createRequest(
      Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>(
        '/event-requests',
        data: data);
    final respData = response.data!;
    return EventRequestModel.fromJson(
        respData['request'] as Map<String, dynamic>? ?? respData);
  }

  @override
  Future<void> vote(String id, bool upvote) async {
    await _dio.post<void>('/event-requests/$id/vote',
        data: {'vote': upvote});
  }

  @override
  Future<void> finalize(String id) async {
    await _dio.post<void>('/event-requests/$id/finalize');
  }

  @override
  Future<void> cancel(String id) async {
    await _dio.post<void>('/event-requests/$id/cancel');
  }
}

final eventRequestRepositoryProvider =
    Provider<EventRequestRepository>((ref) {
  return EventRequestRepositoryImpl(ref.watch(dioProvider));
});
