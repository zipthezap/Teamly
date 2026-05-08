import '../../../core/models/teamup_model.dart';

abstract class TeamUpRepository {
  Future<List<TeamUpRequestModel>> getRequests({
    String? sportType,
    String? requestType,
    String? skillLevel,
    String? city,
    String? search,
    String? fromDate,
    String? toDate,
  });
  Future<List<TeamUpRequestModel>> getNearbyRequests({
    required double latitude,
    required double longitude,
    double radiusKm = 10,
  });
  Future<TeamUpRequestModel> getRequest(String id);
  Future<List<TeamUpRequestModel>> getMyRequests();
  Future<List<TeamUpResponseModel>> getMyResponses();
  Future<List<TeamUpApplicationModel>> getMyApplications();
  Future<TeamUpRequestModel> createRequest(Map<String, dynamic> data);
  Future<TeamUpRequestModel> updateRequest(String id, Map<String, dynamic> data);
  Future<void> deleteRequest(String id);
  Future<void> respondToRequest(
    String id,
    String message, {
    String? requestPositionId,
    String? applicantSkillLevel,
  });
  Future<void> handleResponse(String requestId, String responseId, String action);
  Future<void> withdrawResponse(String requestId);
  Future<List<TeamUpResponseModel>> getRequestResponses(String id);
  Future<List<TeamUpCommentModel>> getComments(String id);
  Future<TeamUpCommentModel> addComment(String id, String content);
  Future<void> deleteComment(String requestId, String commentId);
  Future<void> reportRequest(String requestId, String reason);
}
