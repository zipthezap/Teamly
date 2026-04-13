import '../../../core/models/attendance_model.dart';
import '../../../core/models/session_model.dart';
import '../../../core/models/extended_models.dart';

abstract class SessionRepository {
  /// Returns a page of sessions and an optional cursor for the next page.
  Future<(List<SessionModel>, String?)> getEvents(
      {String? groupId, String? cursor, int limit = 50});
  Future<SessionModel> getEvent(String id);
  Future<SessionModel> getEventByInviteToken(String token);
  Future<void> joinEvent(String id);
  Future<void> joinEventAsGuest(String token, String name);
  Future<void> leaveEvent(String id);
  Future<SessionModel> createEvent(Map<String, dynamic> data);
  Future<SessionModel> updateEvent(String id, Map<String, dynamic> data);
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
  Future<(List<SessionParticipantDetailModel>, ParticipantSummaryModel)>
      getParticipants(String eventId, {String? status});
  Future<(List<SessionGuestModel>, ParticipantSummaryModel)> getGuests(
      String eventId, {String? status});

  // Statistics & Analytics
  Future<SessionStatisticsModel> getEventStatistics();
  Future<InviteAnalyticsModel> getEventInviteAnalytics(String eventId);

  // Nearby
  Future<List<NearbySessionModel>> getNearbyEvents({
    required double latitude,
    required double longitude,
    double radius = 25.0,
  });
}
