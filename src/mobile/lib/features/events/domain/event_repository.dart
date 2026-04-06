import '../../../core/models/event_model.dart';

abstract class EventRepository {
  Future<List<EventModel>> getEvents({String? groupId});
  Future<EventModel> getEvent(String id);
  Future<void> joinEvent(String id);
  Future<void> leaveEvent(String id);
}
