import '../../../core/models/attendance_model.dart';
import '../../../core/models/event_model.dart';
import '../../../core/models/extended_models.dart';

abstract class EventRepository {
  Future<List<EventModel>> getEvents({String? groupId});
  Future<EventModel> getEvent(String id);
  Future<EventModel> getEventByInviteToken(String token);
  Future<void> joinEvent(String id);
  Future<void> joinEventAsGuest(String token, String name);
  Future<void> leaveEvent(String id);
  Future<EventModel> createEvent(Map<String, dynamic> data);
  Future<EventModel> updateEvent(String id, Map<String, dynamic> data);
  Future<void> deleteEvent(String id);
  Future<void> markLate(String eventId);
  Future<void> unmarkLate(String eventId);
  Future<List<ActivityEntryModel>> getActivityFeed(String eventId);
  Future<String> generateInviteToken(String eventId);

  // Attendance
  Future<List<AttendanceModel>> getAttendance(String eventId);
  Future<AttendanceStatsModel> getAttendanceStats(String eventId);
  Future<void> markAttendance(String eventId, String status);
  Future<void> deleteAttendance(String eventId, String userId);

  // Archive
  Future<void> archiveEvent(String id);
  Future<void> unarchiveEvent(String id);

  // Participants & Guests
  Future<(List<EventParticipantDetailModel>, ParticipantSummaryModel)>
      getParticipants(String eventId, {String? status});
  Future<(List<EventGuestModel>, ParticipantSummaryModel)> getGuests(
      String eventId, {String? status});

  // Statistics & Analytics
  Future<EventStatisticsModel> getEventStatistics();
  Future<InviteAnalyticsModel> getEventInviteAnalytics(String eventId);

  // Nearby
  Future<List<NearbyEventModel>> getNearbyEvents({
    required double latitude,
    required double longitude,
    double radius = 25.0,
  });
}
