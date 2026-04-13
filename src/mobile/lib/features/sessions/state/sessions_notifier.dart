import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/attendance_model.dart';
import '../../../core/models/session_model.dart';
import '../../../core/models/extended_models.dart';
import '../data/session_repository_impl.dart';
import '../domain/session_repository.dart';

// ---------------------------------------------------------------------------
// Events list
// ---------------------------------------------------------------------------

/// Riverpod 2.x [AsyncNotifier] for the session list.
///
/// Loads the first page of sessions on build; call [reload] to refresh from
/// the beginning, or [loadMore] to append the next page.
class SessionsNotifier extends AsyncNotifier<List<SessionModel>> {
  String? _nextCursor;
  bool _hasMore = true;

  @override
  Future<List<SessionModel>> build() async {
    _nextCursor = null;
    _hasMore = true;
    final (sessions, nextCursor) =
        await ref.watch(sessionRepositoryProvider).getEvents();
    _nextCursor = nextCursor;
    _hasMore = nextCursor != null;
    return sessions;
  }

  /// Whether more pages are available to load.
  bool get hasMore => _hasMore;

  /// Reload sessions from the beginning, optionally filtered by [groupId].
  Future<void> reload({String? groupId}) async {
    _nextCursor = null;
    _hasMore = true;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final (sessions, nextCursor) = await ref
          .read(sessionRepositoryProvider)
          .getEvents(groupId: groupId);
      _nextCursor = nextCursor;
      _hasMore = nextCursor != null;
      return sessions;
    });
  }

  /// Append the next page of sessions to the current list.
  Future<void> loadMore() async {
    if (!_hasMore || _nextCursor == null) return;
    final current = state.valueOrNull ?? [];
    try {
      final (more, nextCursor) = await ref
          .read(sessionRepositoryProvider)
          .getEvents(cursor: _nextCursor);
      _nextCursor = nextCursor;
      _hasMore = nextCursor != null;
      state = AsyncValue.data([...current, ...more]);
    } catch (_) {
      // Keep current state on error; the UI can retry via pull-to-refresh.
    }
  }
}

final sessionsNotifierProvider =
    AsyncNotifierProvider<SessionsNotifier, List<SessionModel>>(
        SessionsNotifier.new);

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
  final (sessions, _) = await ref
      .watch(sessionRepositoryProvider)
      .getEvents(groupId: groupId);
  return sessions;
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
