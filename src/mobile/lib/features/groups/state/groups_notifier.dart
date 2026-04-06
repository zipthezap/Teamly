import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/group_model.dart';
import '../data/group_repository_impl.dart';
import '../domain/group_repository.dart';

// ---------------------------------------------------------------------------
// Groups list
// ---------------------------------------------------------------------------

class GroupsNotifier extends StateNotifier<AsyncValue<List<GroupModel>>> {
  GroupsNotifier(this._repo) : super(const AsyncValue.loading()) {
    load();
  }

  final GroupRepository _repo;

  Future<void> load() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repo.getGroups());
  }
}

final groupsNotifierProvider =
    StateNotifierProvider<GroupsNotifier, AsyncValue<List<GroupModel>>>((ref) {
  return GroupsNotifier(ref.watch(groupRepositoryProvider));
});

// ---------------------------------------------------------------------------
// Single group detail
// ---------------------------------------------------------------------------

final groupDetailProvider = FutureProvider.family<GroupModel, String>((ref, id) async {
  return ref.watch(groupRepositoryProvider).getGroup(id);
});
