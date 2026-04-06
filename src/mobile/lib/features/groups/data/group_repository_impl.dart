import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
}

final groupRepositoryProvider = Provider<GroupRepository>((ref) {
  return GroupRepositoryImpl(ref.watch(dioProvider));
});
