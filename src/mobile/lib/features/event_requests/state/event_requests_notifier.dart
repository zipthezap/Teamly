import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/event_request_model.dart';
import '../data/event_request_repository_impl.dart';
import '../domain/event_request_repository.dart';

class EventRequestsNotifier
    extends StateNotifier<AsyncValue<List<EventRequestModel>>> {
  EventRequestsNotifier(this._repo) : super(const AsyncValue.loading());

  final EventRequestRepository _repo;

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
    EventRequestsNotifier,
    AsyncValue<List<EventRequestModel>>,
    String>((ref, groupId) {
  final notifier =
      EventRequestsNotifier(ref.watch(eventRequestRepositoryProvider));
  notifier.load(groupId);
  return notifier;
});

final eventRequestDetailProvider =
    FutureProvider.family<EventRequestModel, String>((ref, id) {
  return ref.watch(eventRequestRepositoryProvider).getRequest(id);
});
