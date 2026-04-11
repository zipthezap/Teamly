import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/session_request_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/session_request_repository.dart';

class SessionRequestRepositoryImpl implements SessionRequestRepository {
  SessionRequestRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<SessionRequestModel>> getGroupRequests(String groupId) async {
    final response =
        await _dio.get<dynamic>('/session-requests/group/$groupId');
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
            SessionRequestModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<SessionRequestModel> getRequest(String id) async {
    final response =
        await _dio.get<Map<String, dynamic>>('/session-requests/$id');
    final data = response.data!;
    return SessionRequestModel.fromJson(
        data['request'] as Map<String, dynamic>? ?? data);
  }

  @override
  Future<SessionRequestModel> createRequest(
      Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>(
        '/session-requests',
        data: data);
    final respData = response.data!;
    return SessionRequestModel.fromJson(
        respData['request'] as Map<String, dynamic>? ?? respData);
  }

  @override
  Future<void> vote(String id, bool upvote) async {
    await _dio.post<void>('/session-requests/$id/vote',
        data: {'vote': upvote});
  }

  @override
  Future<void> finalize(String id) async {
    await _dio.post<void>('/session-requests/$id/finalize');
  }

  @override
  Future<void> cancel(String id) async {
    await _dio.post<void>('/session-requests/$id/cancel');
  }
}

final sessionRequestRepositoryProvider =
    Provider<SessionRequestRepository>((ref) {
  return SessionRequestRepositoryImpl(ref.watch(dioProvider));
});
