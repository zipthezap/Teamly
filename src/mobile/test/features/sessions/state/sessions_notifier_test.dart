import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:teamly_mobile/core/models/attendance_model.dart';
import 'package:teamly_mobile/core/models/extended_models.dart';
import 'package:teamly_mobile/core/models/session_model.dart';
import 'package:teamly_mobile/features/sessions/data/session_repository_impl.dart';
import 'package:teamly_mobile/features/sessions/domain/session_repository.dart';
import 'package:teamly_mobile/features/sessions/state/sessions_notifier.dart';

class _FakeSessionRepository implements SessionRepository {
  _FakeSessionRepository({required this.pages});

  /// Each entry is a (sessions, nextCursor) page keyed by the cursor used to
  /// request it (`null` for the first page).
  final Map<String?, (List<SessionModel>, String?)> pages;

  int getEventsCalls = 0;
  String? lastGroupId;
  String? lastCursor;

  @override
  Future<(List<SessionModel>, String?)> getEvents({
    String? groupId,
    String? cursor,
    int limit = 50,
  }) async {
    getEventsCalls += 1;
    lastGroupId = groupId;
    lastCursor = cursor;
    return pages[cursor] ?? (const <SessionModel>[], null);
  }

  @override
  Future<SessionModel> getEvent(String id) => throw UnimplementedError();

  @override
  Future<SessionModel> getEventByInviteToken(String token) =>
      throw UnimplementedError();

  @override
  Future<void> joinEvent(String id) => throw UnimplementedError();

  @override
  Future<void> joinEventAsGuest(String token, String name) =>
      throw UnimplementedError();

  @override
  Future<void> leaveEvent(String id) => throw UnimplementedError();

  @override
  Future<SessionModel> createEvent(Map<String, dynamic> data) =>
      throw UnimplementedError();

  @override
  Future<SessionModel> updateEvent(String id, Map<String, dynamic> data) =>
      throw UnimplementedError();

  @override
  Future<void> deleteEvent(String id) => throw UnimplementedError();

  @override
  Future<void> markLate(String eventId) => throw UnimplementedError();

  @override
  Future<void> unmarkLate(String eventId) => throw UnimplementedError();

  @override
  Future<List<ActivityEntryModel>> getActivityFeed(String eventId) =>
      throw UnimplementedError();

  @override
  Future<String> generateInviteToken(String eventId) =>
      throw UnimplementedError();

  @override
  Future<List<AttendanceModel>> getAttendance(String eventId) =>
      throw UnimplementedError();

  @override
  Future<AttendanceStatsModel> getAttendanceStats(String eventId) =>
      throw UnimplementedError();

  @override
  Future<void> markAttendance(String eventId, String status) =>
      throw UnimplementedError();

  @override
  Future<void> deleteAttendance(String eventId, String userId) =>
      throw UnimplementedError();

  @override
  Future<void> archiveEvent(String id) => throw UnimplementedError();

  @override
  Future<void> unarchiveEvent(String id) => throw UnimplementedError();

  @override
  Future<(List<SessionParticipantDetailModel>, ParticipantSummaryModel)>
      getParticipants(String eventId, {String? status}) =>
          throw UnimplementedError();

  @override
  Future<(List<SessionGuestModel>, ParticipantSummaryModel)> getGuests(
          String eventId, {String? status}) =>
      throw UnimplementedError();

  @override
  Future<SessionStatisticsModel> getEventStatistics() =>
      throw UnimplementedError();

  @override
  Future<InviteAnalyticsModel> getEventInviteAnalytics(String eventId) =>
      throw UnimplementedError();

  @override
  Future<List<NearbySessionModel>> getNearbyEvents({
    required double latitude,
    required double longitude,
    double radius = 25.0,
  }) =>
      throw UnimplementedError();
}

SessionModel _session(String id, String title) {
  return SessionModel(
    id: id,
    title: title,
    startTime: DateTime.utc(2026, 1, 1, 10),
    endTime: DateTime.utc(2026, 1, 1, 12),
    isPublic: true,
    creator: const SessionCreatorModel(
      id: 'creator-1',
      name: 'Alex',
      email: 'alex@example.com',
    ),
    group: const SessionGroupRef(id: 'group-1', name: 'Sunday League'),
  );
}

void main() {
  test('loads the first page of sessions on build', () async {
    final first = _session('s1', 'Morning Kickabout');
    final fakeRepo = _FakeSessionRepository(pages: {
      null: ([first], 'cursor-2'),
    });

    final container = ProviderContainer(
      overrides: [sessionRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    final result = await container.read(sessionsNotifierProvider.future);

    expect(result, [first]);
    expect(fakeRepo.getEventsCalls, 1);
    expect(container.read(sessionsNotifierProvider.notifier).hasMore, isTrue);
  });

  test('reload resets pagination and refetches from the beginning', () async {
    final first = _session('s1', 'Morning Kickabout');
    final second = _session('s2', 'Evening Match');
    final fakeRepo = _FakeSessionRepository(pages: {
      null: ([first], null),
    });

    final container = ProviderContainer(
      overrides: [sessionRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container.read(sessionsNotifierProvider.future);
    fakeRepo.pages[null] = ([first, second], null);

    await container.read(sessionsNotifierProvider.notifier).reload(groupId: 'group-1');

    expect(
      container.read(sessionsNotifierProvider).requireValue,
      [first, second],
    );
    expect(fakeRepo.lastGroupId, 'group-1');
    expect(fakeRepo.getEventsCalls, 2);
    expect(container.read(sessionsNotifierProvider.notifier).hasMore, isFalse);
  });

  test('loadMore appends the next page using the returned cursor', () async {
    final first = _session('s1', 'Morning Kickabout');
    final second = _session('s2', 'Evening Match');
    final fakeRepo = _FakeSessionRepository(pages: {
      null: ([first], 'cursor-2'),
      'cursor-2': ([second], null),
    });

    final container = ProviderContainer(
      overrides: [sessionRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container.read(sessionsNotifierProvider.future);
    await container.read(sessionsNotifierProvider.notifier).loadMore();

    expect(
      container.read(sessionsNotifierProvider).requireValue,
      [first, second],
    );
    expect(fakeRepo.lastCursor, 'cursor-2');
    expect(container.read(sessionsNotifierProvider.notifier).hasMore, isFalse);
  });

  test('loadMore is a no-op once hasMore is false', () async {
    final first = _session('s1', 'Morning Kickabout');
    final fakeRepo = _FakeSessionRepository(pages: {
      null: ([first], null),
    });

    final container = ProviderContainer(
      overrides: [sessionRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container.read(sessionsNotifierProvider.future);
    await container.read(sessionsNotifierProvider.notifier).loadMore();

    expect(fakeRepo.getEventsCalls, 1);
    expect(container.read(sessionsNotifierProvider).requireValue, [first]);
  });
}
