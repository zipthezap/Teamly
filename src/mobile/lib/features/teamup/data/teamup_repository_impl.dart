import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/teamup_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/teamup_repository.dart';

class TeamUpRepositoryImpl implements TeamUpRepository {
  TeamUpRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<TeamUpRequestModel>> getRequests({
    String? sportType,
    String? requestType,
  }) async {
    final response = await _dio.get<dynamic>(
      '/teamup',
      queryParameters: {
        if (sportType != null && sportType.isNotEmpty) 'sportType': sportType,
        if (requestType != null && requestType.isNotEmpty)
          'requestType': requestType,
        'limit': '50',
      },
    );
    return _parseList(response.data, 'requests');
  }

  @override
  Future<TeamUpRequestModel> getRequest(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/teamup/$id');
    return TeamUpRequestModel.fromJson(response.data!);
  }

  @override
  Future<List<TeamUpRequestModel>> getMyRequests() async {
    final response = await _dio.get<dynamic>('/teamup/my-requests');
    return _parseList(response.data, 'requests');
  }

  @override
  Future<List<TeamUpResponseModel>> getMyResponses() async {
    final response = await _dio.get<dynamic>('/teamup/my-responses');
    final data = response.data;
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['responses'] as List<dynamic>? ?? [];
    } else {
      items = [];
    }
    return items
        .map((e) => TeamUpResponseModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TeamUpRequestModel> createRequest(Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>('/teamup', data: data);
    return TeamUpRequestModel.fromJson(response.data!);
  }

  @override
  Future<void> respondToRequest(String id, String message) async {
    await _dio.post<void>('/teamup/$id/respond', data: {'message': message});
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
  Future<List<TeamUpResponseModel>> getRequestResponses(String id) async {
    // Responses are embedded in the full request detail
    final response = await _dio.get<Map<String, dynamic>>('/teamup/$id');
    final data = response.data!;
    final items = data['responses'] as List<dynamic>? ?? [];
    return items
        .map((e) => TeamUpResponseModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  List<TeamUpRequestModel> _parseList(dynamic data, String key) {
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data[key] as List<dynamic>? ?? data['data'] as List<dynamic>? ?? [];
    } else {
      items = [];
    }
    return items
        .map((e) => TeamUpRequestModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final teamUpRepositoryProvider = Provider<TeamUpRepository>((ref) {
  return TeamUpRepositoryImpl(ref.watch(dioProvider));
});
