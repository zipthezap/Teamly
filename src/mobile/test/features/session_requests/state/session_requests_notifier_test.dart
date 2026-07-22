import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:teamly_mobile/core/models/session_request_model.dart';
import 'package:teamly_mobile/features/session_requests/data/session_request_repository_impl.dart';
import 'package:teamly_mobile/features/session_requests/domain/session_request_repository.dart';
import 'package:teamly_mobile/features/session_requests/state/session_requests_notifier.dart';

class _FakeSessionRequestRepository implements SessionRequestRepository {
  _FakeSessionRequestRepository({required this.requestsByGroup});

  final Map<String, List<SessionRequestModel>> requestsByGroup;
  int getGroupRequestsCalls = 0;
  int voteCalls = 0;
  int finalizeCalls = 0;
  int cancelCalls = 0;
  int createCalls = 0;
  String? lastVotedId;
  bool? lastVoteValue;

  @override
  Future<List<SessionRequestModel>> getGroupRequests(String groupId) async {
    getGroupRequestsCalls += 1;
    return requestsByGroup[groupId] ?? const [];
  }

  @override
  Future<SessionRequestModel> getRequest(String id) =>
      throw UnimplementedError();

  @override
  Future<SessionRequestModel> createRequest(Map<String, dynamic> data) async {
    createCalls += 1;
    return _request('new-request', data['groupId'] as String);
  }

  @override
  Future<void> vote(String id, bool upvote) async {
    voteCalls += 1;
    lastVotedId = id;
    lastVoteValue = upvote;
  }

  @override
  Future<void> finalize(String id) async {
    finalizeCalls += 1;
  }

  @override
  Future<void> cancel(String id) async {
    cancelCalls += 1;
  }
}

SessionRequestModel _request(String id, String groupId) {
  return SessionRequestModel(
    id: id,
    groupId: groupId,
    title: 'Add a session',
    status: 'pending',
    createdById: 'u1',
    voteCount: 0,
    totalVotes: 0,
    createdAt: DateTime.utc(2026, 1, 1),
  );
}

void main() {
  test('build loads requests for the given group', () async {
    final request = _request('sr1', 'g1');
    final fakeRepo = _FakeSessionRequestRepository(requestsByGroup: {
      'g1': [request],
    });

    final container = ProviderContainer(
      overrides: [
        sessionRequestRepositoryProvider.overrideWithValue(fakeRepo),
      ],
    );
    addTearDown(container.dispose);

    final result =
        await container.read(eventRequestsNotifierProvider('g1').future);

    expect(result, [request]);
    expect(fakeRepo.getGroupRequestsCalls, 1);
  });

  test('vote reloads the list after voting', () async {
    final request = _request('sr1', 'g1');
    final fakeRepo = _FakeSessionRequestRepository(requestsByGroup: {
      'g1': [request],
    });

    final container = ProviderContainer(
      overrides: [
        sessionRequestRepositoryProvider.overrideWithValue(fakeRepo),
      ],
    );
    addTearDown(container.dispose);

    await container.read(eventRequestsNotifierProvider('g1').future);
    await container
        .read(eventRequestsNotifierProvider('g1').notifier)
        .vote('sr1', true);

    expect(fakeRepo.lastVotedId, 'sr1');
    expect(fakeRepo.lastVoteValue, isTrue);
    expect(fakeRepo.getGroupRequestsCalls, 2);
  });

  test('finalize and cancel each trigger a reload', () async {
    final request = _request('sr1', 'g1');
    final fakeRepo = _FakeSessionRequestRepository(requestsByGroup: {
      'g1': [request],
    });

    final container = ProviderContainer(
      overrides: [
        sessionRequestRepositoryProvider.overrideWithValue(fakeRepo),
      ],
    );
    addTearDown(container.dispose);

    await container.read(eventRequestsNotifierProvider('g1').future);
    await container
        .read(eventRequestsNotifierProvider('g1').notifier)
        .finalize('sr1');
    await container
        .read(eventRequestsNotifierProvider('g1').notifier)
        .cancel('sr1');

    expect(fakeRepo.finalizeCalls, 1);
    expect(fakeRepo.cancelCalls, 1);
    expect(fakeRepo.getGroupRequestsCalls, 3);
  });

  test('create submits data then reloads the group list', () async {
    final fakeRepo = _FakeSessionRequestRepository(requestsByGroup: {
      'g1': [],
    });

    final container = ProviderContainer(
      overrides: [
        sessionRequestRepositoryProvider.overrideWithValue(fakeRepo),
      ],
    );
    addTearDown(container.dispose);

    await container.read(eventRequestsNotifierProvider('g1').future);
    await container
        .read(eventRequestsNotifierProvider('g1').notifier)
        .create({'groupId': 'g1', 'title': 'Add a session'});

    expect(fakeRepo.createCalls, 1);
    expect(fakeRepo.getGroupRequestsCalls, 2);
  });
}
