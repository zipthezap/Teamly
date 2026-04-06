import '../../../core/models/event_request_model.dart';

abstract class EventRequestRepository {
  Future<List<EventRequestModel>> getGroupRequests(String groupId);
  Future<EventRequestModel> getRequest(String id);
  Future<EventRequestModel> createRequest(Map<String, dynamic> data);
  Future<void> vote(String id, bool upvote);
  Future<void> finalize(String id);
  Future<void> cancel(String id);
}
