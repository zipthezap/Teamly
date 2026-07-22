import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:teamly_mobile/core/models/teamup_model.dart';
import 'package:teamly_mobile/features/teamup/data/teamup_repository_impl.dart';
import 'package:teamly_mobile/features/teamup/domain/teamup_repository.dart';
import 'package:teamly_mobile/features/teamup/state/teamup_notifier.dart';

class _FakeTeamUpRepository implements TeamUpRepository {
  _FakeTeamUpRepository({required this.pages});

  /// Keyed by cursor (`null` for the first page).
  final Map<String?, TeamUpBrowseResult> pages;
  int getRequestsCalls = 0;
  String? lastCursor;

  @override
  Future<TeamUpBrowseResult> getRequests({
    String? sportType,
    String? requestType,
    String? skillLevel,
    String? city,
    String? search,
    String? fromDate,
    String? toDate,
    String? cursor,
  }) async {
    getRequestsCalls += 1;
    lastCursor = cursor;
    return pages[cursor] ??
        const TeamUpBrowseResult(data: [], hasMore: false);
  }

  @override
  Future<List<TeamUpRequestModel>> getNearbyRequests({
    required double latitude,
    required double longitude,
    double radiusKm = 10,
  }) =>
      throw UnimplementedError();

  @override
  Future<TeamUpRequestModel> getRequest(String id) =>
      throw UnimplementedError();

  @override
  Future<List<TeamUpRequestModel>> getMyRequests() =>
      throw UnimplementedError();

  @override
  Future<List<TeamUpResponseModel>> getMyResponses() =>
      throw UnimplementedError();

  @override
  Future<List<TeamUpApplicationModel>> getMyApplications() =>
      throw UnimplementedError();

  @override
  Future<TeamUpRequestModel> createRequest(Map<String, dynamic> data) =>
      throw UnimplementedError();

  @override
  Future<TeamUpRequestModel> updateRequest(
          String id, Map<String, dynamic> data) =>
      throw UnimplementedError();

  @override
  Future<void> deleteRequest(String id) => throw UnimplementedError();

  @override
  Future<void> respondToRequest(
    String id,
    String message, {
    String? requestPositionId,
    String? applicantSkillLevel,
  }) =>
      throw UnimplementedError();

  @override
  Future<void> handleResponse(
          String requestId, String responseId, String action) =>
      throw UnimplementedError();

  @override
  Future<void> withdrawResponse(String requestId) =>
      throw UnimplementedError();

  @override
  Future<void> updateRsvp(String requestId, String rsvpStatus) =>
      throw UnimplementedError();

  @override
  Future<List<TeamUpResponseModel>> getRequestResponses(String id) =>
      throw UnimplementedError();

  @override
  Future<List<TeamUpCommentModel>> getComments(String id) =>
      throw UnimplementedError();

  @override
  Future<TeamUpCommentModel> addComment(String id, String content) =>
      throw UnimplementedError();

  @override
  Future<void> deleteComment(String requestId, String commentId) =>
      throw UnimplementedError();

  @override
  Future<void> reportRequest(String requestId, String reason) =>
      throw UnimplementedError();

  @override
  Future<TeamUpAttendanceHistoryModel> getAttendanceHistory() =>
      throw UnimplementedError();

  @override
  Future<List<TeamUpSavedSearchModel>> listSavedSearches() =>
      throw UnimplementedError();

  @override
  Future<TeamUpSavedSearchModel> createSavedSearch(
          Map<String, dynamic> data) =>
      throw UnimplementedError();

  @override
  Future<void> deleteSavedSearch(String searchId) =>
      throw UnimplementedError();

  @override
  Future<TeamUpAnalyticsModel> getTeamUpAnalytics(
          {String? fromDate, String? toDate}) =>
      throw UnimplementedError();

  @override
  Future<void> markAttendance(
          String requestId, String responseId, String attendanceStatus) =>
      throw UnimplementedError();

  @override
  Future<void> bulkHandleResponses(
          String requestId, String action, List<String> responseIds) =>
      throw UnimplementedError();

  @override
  Future<void> sendReminderNudges(String requestId) =>
      throw UnimplementedError();

  @override
  Future<List<TeamUpReplacementSuggestionModel>> getReplacementSuggestions(
          String requestId, {String? requestPositionId}) =>
      throw UnimplementedError();
}

TeamUpRequestModel _request(String id, String title) {
  return TeamUpRequestModel.fromJson({
    'id': id,
    'title': title,
    'sportType': 'football',
    'requestType': 'need_players',
    'status': 'open',
    'createdAt': '2026-05-08T10:00:00.000Z',
    'creatorId': 'creator-1',
  });
}

void main() {
  test('build loads the first page of requests', () async {
    final first = _request('req-1', 'Need a keeper');
    final fakeRepo = _FakeTeamUpRepository(pages: {
      null: TeamUpBrowseResult(data: [first], hasMore: true, nextCursor: 'cursor-2'),
    });

    final container = ProviderContainer(
      overrides: [teamUpRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    final result = await container.read(teamUpNotifierProvider.future);

    expect(result, [first]);
    expect(container.read(teamUpNotifierProvider.notifier).hasMore, isTrue);
    expect(fakeRepo.getRequestsCalls, 1);
  });

  test('load applies filters and resets pagination', () async {
    final first = _request('req-1', 'Need a keeper');
    final second = _request('req-2', 'Need a striker');
    final fakeRepo = _FakeTeamUpRepository(pages: {
      null: TeamUpBrowseResult(data: [first], hasMore: false),
    });

    final container = ProviderContainer(
      overrides: [teamUpRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container.read(teamUpNotifierProvider.future);
    fakeRepo.pages[null] = TeamUpBrowseResult(data: [second], hasMore: false);

    await container
        .read(teamUpNotifierProvider.notifier)
        .load(sportType: 'football', city: 'Toronto');

    expect(container.read(teamUpNotifierProvider).requireValue, [second]);
    expect(fakeRepo.getRequestsCalls, 2);
  });

  test('loadMore appends the next page and stops when hasMore is false', () async {
    final first = _request('req-1', 'Need a keeper');
    final second = _request('req-2', 'Need a striker');
    final fakeRepo = _FakeTeamUpRepository(pages: {
      null: TeamUpBrowseResult(data: [first], hasMore: true, nextCursor: 'cursor-2'),
      'cursor-2': TeamUpBrowseResult(data: [second], hasMore: false),
    });

    final container = ProviderContainer(
      overrides: [teamUpRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container.read(teamUpNotifierProvider.future);
    await container.read(teamUpNotifierProvider.notifier).loadMore();

    expect(
      container.read(teamUpNotifierProvider).requireValue,
      [first, second],
    );
    expect(fakeRepo.lastCursor, 'cursor-2');
    expect(container.read(teamUpNotifierProvider.notifier).hasMore, isFalse);

    // A further loadMore should be a no-op since hasMore is now false.
    await container.read(teamUpNotifierProvider.notifier).loadMore();
    expect(fakeRepo.getRequestsCalls, 2);
  });

  test('refresh reloads using the currently applied filters', () async {
    final first = _request('req-1', 'Need a keeper');
    final fakeRepo = _FakeTeamUpRepository(pages: {
      null: TeamUpBrowseResult(data: [first], hasMore: false),
    });

    final container = ProviderContainer(
      overrides: [teamUpRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container.read(teamUpNotifierProvider.future);
    await container
        .read(teamUpNotifierProvider.notifier)
        .load(sportType: 'football');
    await container.read(teamUpNotifierProvider.notifier).refresh();

    expect(fakeRepo.getRequestsCalls, 3);
  });
}
