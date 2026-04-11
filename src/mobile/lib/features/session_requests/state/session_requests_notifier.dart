import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/session_request_model.dart';
import '../data/session_request_repository_impl.dart';
import '../domain/session_request_repository.dart';

class SessionRequestsNotifier
    extends StateNotifier<AsyncValue<List<SessionRequestModel>>> {
  SessionRequestsNotifier(this._repo) : super(const AsyncValue.loading());

  final SessionRequestRepository _repo;

  Future<void> load(String groupId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => _repo.getGroupRequests(groupId),
    );
  }

  Future<void> create(Map<String, dynamic> data, String groupId) async {
    await _repo.createRequest(data);
    await load(groupId);
  }

  Future<void> vote(String id, bool upvote, String groupId) async {
    await _repo.vote(id, upvote);
    await load(groupId);
  }

  Future<void> finalize(String id, String groupId) async {
    await _repo.finalize(id);
    await load(groupId);
  }

  Future<void> cancel(String id, String groupId) async {
    await _repo.cancel(id);
    await load(groupId);
  }
}

final eventRequestsNotifierProvider = StateNotifierProvider.family<
    SessionRequestsNotifier,
    AsyncValue<List<SessionRequestModel>>,
    String>((ref, groupId) {
  final notifier =
      SessionRequestsNotifier(ref.watch(sessionRequestRepositoryProvider));
  notifier.load(groupId);
  return notifier;
});

final eventRequestDetailProvider =
    FutureProvider.family<SessionRequestModel, String>((ref, id) {
  return ref.watch(sessionRequestRepositoryProvider).getRequest(id);
});
