import '../../../core/models/event_model.dart';

abstract class EventRepository {
  Future<List<EventModel>> getEvents({String? groupId});
  Future<EventModel> getEvent(String id);
  Future<void> joinEvent(String id);
  Future<void> leaveEvent(String id);
  Future<EventModel> createEvent(Map<String, dynamic> data);
  Future<EventModel> updateEvent(String id, Map<String, dynamic> data);
  Future<void> deleteEvent(String id);
  Future<void> markLate(String eventId);
  Future<void> unmarkLate(String eventId);
  Future<List<ActivityEntryModel>> getActivityFeed(String eventId);
  Future<String> generateInviteToken(String eventId);
}
