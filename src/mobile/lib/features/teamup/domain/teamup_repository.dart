import '../../../core/models/teamup_model.dart';

abstract class TeamUpRepository {
  Future<List<TeamUpRequestModel>> getRequests({String? sportType, String? requestType});
  Future<TeamUpRequestModel> getRequest(String id);
  Future<List<TeamUpRequestModel>> getMyRequests();
  Future<List<TeamUpResponseModel>> getMyResponses();
  Future<TeamUpRequestModel> createRequest(Map<String, dynamic> data);
  Future<void> respondToRequest(String id, String message);
  Future<void> handleResponse(String requestId, String responseId, String action);
  Future<List<TeamUpResponseModel>> getRequestResponses(String id);
}
