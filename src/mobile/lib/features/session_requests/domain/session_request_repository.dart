import '../../../core/models/session_request_model.dart';

abstract class SessionRequestRepository {
  Future<List<SessionRequestModel>> getGroupRequests(String groupId);
  Future<SessionRequestModel> getRequest(String id);
  Future<SessionRequestModel> createRequest(Map<String, dynamic> data);
  Future<void> vote(String id, bool upvote);
  Future<void> finalize(String id);
  Future<void> cancel(String id);
}
