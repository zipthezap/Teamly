import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/session_request_model.dart';
import '../data/session_request_repository_impl.dart';

class SessionRequestsNotifier
    extends FamilyAsyncNotifier<List<SessionRequestModel>, String> {
  @override
  Future<List<SessionRequestModel>> build(String groupId) {
    return ref.watch(sessionRequestRepositoryProvider).getGroupRequests(groupId);
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(sessionRequestRepositoryProvider).getGroupRequests(arg),
    );
  }

  Future<void> create(Map<String, dynamic> data) async {
    await ref.read(sessionRequestRepositoryProvider).createRequest(data);
    await reload();
  }

  Future<void> vote(String id, bool upvote) async {
    await ref.read(sessionRequestRepositoryProvider).vote(id, upvote);
    await reload();
  }

  Future<void> finalize(String id) async {
    await ref.read(sessionRequestRepositoryProvider).finalize(id);
    await reload();
  }

  Future<void> cancel(String id) async {
    await ref.read(sessionRequestRepositoryProvider).cancel(id);
    await reload();
  }
}

final eventRequestsNotifierProvider = AsyncNotifierProvider.family<
    SessionRequestsNotifier,
    List<SessionRequestModel>,
    String>(SessionRequestsNotifier.new);

final eventRequestDetailProvider =
    FutureProvider.family<SessionRequestModel, String>((ref, id) {
  return ref.watch(sessionRequestRepositoryProvider).getRequest(id);
});
