import '../../../core/models/comment_model.dart';

abstract class CommentRepository {
  Future<List<CommentModel>> getEventComments(String eventId);
  Future<CommentModel> createComment(String eventId, String content);
  Future<CommentModel> updateComment(String commentId, String content);
  Future<void> deleteComment(String commentId);
}
