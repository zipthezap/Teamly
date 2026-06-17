import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/comment_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/comment_repository.dart';

class CommentRepositoryImpl implements CommentRepository {
  CommentRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<CommentModel>> getEventComments(String eventId) async {
    final response =
      await _dio.get<dynamic>('/comments/session/$eventId');
    final data = response.data;
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['comments'] as List<dynamic>? ?? [];
    } else {
      items = [];
    }
    return items
        .map((e) => CommentModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<CommentModel> createComment(String eventId, String content) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/comments',
      data: {'sessionId': eventId, 'content': content},
    );
    final data = response.data!;
    return CommentModel.fromJson(
        data['comment'] as Map<String, dynamic>? ?? data);
  }

  @override
  Future<CommentModel> updateComment(
      String commentId, String content) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/comments/$commentId',
      data: {'content': content},
    );
    final data = response.data!;
    return CommentModel.fromJson(
        data['comment'] as Map<String, dynamic>? ?? data);
  }

  @override
  Future<void> deleteComment(String commentId) async {
    await _dio.delete<void>('/comments/$commentId');
  }
}

final commentRepositoryProvider = Provider<CommentRepository>((ref) {
  return CommentRepositoryImpl(ref.watch(dioProvider));
});
