import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/attendance_model.dart';
import '../../../core/models/session_model.dart';
import '../../../core/models/extended_models.dart';
import '../data/session_repository_impl.dart';
import '../domain/session_repository.dart';

// ---------------------------------------------------------------------------
// Events list
// ---------------------------------------------------------------------------

class SessionsNotifier extends StateNotifier<AsyncValue<List<SessionModel>>> {
  SessionsNotifier(this._repo) : super(const AsyncValue.loading()) {
    load();
  }

  final SessionRepository _repo;

  Future<void> load({String? groupId}) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repo.getEvents(groupId: groupId));
  }
}

final sessionsNotifierProvider =
    StateNotifierProvider<SessionsNotifier, AsyncValue<List<SessionModel>>>((ref) {
  return SessionsNotifier(ref.watch(sessionRepositoryProvider));
});

// ---------------------------------------------------------------------------
// Event detail (also used to refresh after join/leave)
// ---------------------------------------------------------------------------

final eventDetailProvider = FutureProvider.family<SessionModel, String>((ref, id) async {
  return ref.watch(sessionRepositoryProvider).getEvent(id);
});

// ---------------------------------------------------------------------------
// Events filtered by group (used in group detail page)
// ---------------------------------------------------------------------------

final groupEventsProvider =
    FutureProvider.family<List<SessionModel>, String>((ref, groupId) async {
  return ref.watch(sessionRepositoryProvider).getEvents(groupId: groupId);
});

// ---------------------------------------------------------------------------
// Activity feed for an event
// ---------------------------------------------------------------------------

final activityFeedProvider =
    FutureProvider.family<List<ActivityEntryModel>, String>((ref, eventId) async {
  return ref.watch(sessionRepositoryProvider).getActivityFeed(eventId);
});

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

final attendanceProvider =
    FutureProvider.family<List<AttendanceModel>, String>((ref, eventId) async {
  return ref.watch(sessionRepositoryProvider).getAttendance(eventId);
});

final attendanceStatsProvider =
    FutureProvider.family<AttendanceStatsModel, String>((ref, eventId) async {
  return ref.watch(sessionRepositoryProvider).getAttendanceStats(eventId);
});

// ---------------------------------------------------------------------------
// Participants & Guests
// ---------------------------------------------------------------------------

final eventParticipantsProvider = FutureProvider.family<
    (List<SessionParticipantDetailModel>, ParticipantSummaryModel),
    String>((ref, eventId) async {
  return ref.watch(sessionRepositoryProvider).getParticipants(eventId);
});

final eventGuestsProvider = FutureProvider.family<
    (List<SessionGuestModel>, ParticipantSummaryModel),
    String>((ref, eventId) async {
  return ref.watch(sessionRepositoryProvider).getGuests(eventId);
});

// ---------------------------------------------------------------------------
// Statistics & Analytics
// ---------------------------------------------------------------------------

final eventStatisticsProvider =
    FutureProvider<SessionStatisticsModel>((ref) async {
  return ref.watch(sessionRepositoryProvider).getEventStatistics();
});

final eventInviteAnalyticsProvider =
    FutureProvider.family<InviteAnalyticsModel, String>((ref, eventId) async {
  return ref.watch(sessionRepositoryProvider).getEventInviteAnalytics(eventId);
});
