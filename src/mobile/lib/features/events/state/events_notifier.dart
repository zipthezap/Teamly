import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/attendance_model.dart';
import '../../../core/models/event_model.dart';
import '../../../core/models/extended_models.dart';
import '../data/event_repository_impl.dart';
import '../domain/event_repository.dart';

// ---------------------------------------------------------------------------
// Events list
// ---------------------------------------------------------------------------

class EventsNotifier extends StateNotifier<AsyncValue<List<EventModel>>> {
  EventsNotifier(this._repo) : super(const AsyncValue.loading()) {
    load();
  }

  final EventRepository _repo;

  Future<void> load({String? groupId}) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repo.getEvents(groupId: groupId));
  }
}

final eventsNotifierProvider =
    StateNotifierProvider<EventsNotifier, AsyncValue<List<EventModel>>>((ref) {
  return EventsNotifier(ref.watch(eventRepositoryProvider));
});

// ---------------------------------------------------------------------------
// Event detail (also used to refresh after join/leave)
// ---------------------------------------------------------------------------

final eventDetailProvider = FutureProvider.family<EventModel, String>((ref, id) async {
  return ref.watch(eventRepositoryProvider).getEvent(id);
});

// ---------------------------------------------------------------------------
// Events filtered by group (used in group detail page)
// ---------------------------------------------------------------------------

final groupEventsProvider =
    FutureProvider.family<List<EventModel>, String>((ref, groupId) async {
  return ref.watch(eventRepositoryProvider).getEvents(groupId: groupId);
});

// ---------------------------------------------------------------------------
// Activity feed for an event
// ---------------------------------------------------------------------------

final activityFeedProvider =
    FutureProvider.family<List<ActivityEntryModel>, String>((ref, eventId) async {
  return ref.watch(eventRepositoryProvider).getActivityFeed(eventId);
});

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

final attendanceProvider =
    FutureProvider.family<List<AttendanceModel>, String>((ref, eventId) async {
  return ref.watch(eventRepositoryProvider).getAttendance(eventId);
});

final attendanceStatsProvider =
    FutureProvider.family<AttendanceStatsModel, String>((ref, eventId) async {
  return ref.watch(eventRepositoryProvider).getAttendanceStats(eventId);
});

// ---------------------------------------------------------------------------
// Participants & Guests
// ---------------------------------------------------------------------------

final eventParticipantsProvider = FutureProvider.family<
    (List<EventParticipantDetailModel>, ParticipantSummaryModel),
    String>((ref, eventId) async {
  return ref.watch(eventRepositoryProvider).getParticipants(eventId);
});

final eventGuestsProvider = FutureProvider.family<
    (List<EventGuestModel>, ParticipantSummaryModel),
    String>((ref, eventId) async {
  return ref.watch(eventRepositoryProvider).getGuests(eventId);
});

// ---------------------------------------------------------------------------
// Statistics & Analytics
// ---------------------------------------------------------------------------

final eventStatisticsProvider =
    FutureProvider<EventStatisticsModel>((ref) async {
  return ref.watch(eventRepositoryProvider).getEventStatistics();
});

final eventInviteAnalyticsProvider =
    FutureProvider.family<InviteAnalyticsModel, String>((ref, eventId) async {
  return ref.watch(eventRepositoryProvider).getEventInviteAnalytics(eventId);
});
