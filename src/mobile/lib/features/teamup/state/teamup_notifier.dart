import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/teamup_model.dart';
import '../data/teamup_repository_impl.dart';
import '../domain/teamup_repository.dart';

// ---------------------------------------------------------------------------
// Browse requests
// ---------------------------------------------------------------------------

class TeamUpNotifier
    extends StateNotifier<AsyncValue<List<TeamUpRequestModel>>> {
  TeamUpNotifier(this._repo) : super(const AsyncValue.loading()) {
    load();
  }

  final TeamUpRepository _repo;
  String? _sportType;
  String? _requestType;

  Future<void> load({String? sportType, String? requestType}) async {
    _sportType = sportType;
    _requestType = requestType;
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => _repo.getRequests(
        sportType: _sportType,
        requestType: _requestType,
      ),
    );
  }

  Future<void> refresh() =>
      load(sportType: _sportType, requestType: _requestType);
}

final teamUpNotifierProvider =
    StateNotifierProvider<TeamUpNotifier, AsyncValue<List<TeamUpRequestModel>>>(
  (ref) => TeamUpNotifier(ref.watch(teamUpRepositoryProvider)),
);

// ---------------------------------------------------------------------------
// My requests
// ---------------------------------------------------------------------------

final myTeamUpRequestsProvider =
    FutureProvider<List<TeamUpRequestModel>>((ref) async {
  return ref.watch(teamUpRepositoryProvider).getMyRequests();
});

// ---------------------------------------------------------------------------
// My responses
// ---------------------------------------------------------------------------

final myTeamUpResponsesProvider =
    FutureProvider<List<TeamUpResponseModel>>((ref) async {
  return ref.watch(teamUpRepositoryProvider).getMyResponses();
});

// ---------------------------------------------------------------------------
// Single request detail
// ---------------------------------------------------------------------------

final teamUpRequestDetailProvider =
    FutureProvider.family<TeamUpRequestModel, String>((ref, id) async {
  return ref.watch(teamUpRepositoryProvider).getRequest(id);
});

// ---------------------------------------------------------------------------
// Responses for a specific request
// ---------------------------------------------------------------------------

final teamUpRequestResponsesProvider =
    FutureProvider.family<List<TeamUpResponseModel>, String>((ref, id) async {
  return ref.watch(teamUpRepositoryProvider).getRequestResponses(id);
});
