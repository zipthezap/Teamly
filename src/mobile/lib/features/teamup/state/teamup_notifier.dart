import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/teamup_model.dart';
import '../data/teamup_repository_impl.dart';

// ---------------------------------------------------------------------------
// Browse requests
// ---------------------------------------------------------------------------

class TeamUpNotifier extends AsyncNotifier<List<TeamUpRequestModel>> {
  String? _sportType;
  String? _requestType;

  @override
  Future<List<TeamUpRequestModel>> build() {
    return ref.watch(teamUpRepositoryProvider).getRequests(
          sportType: _sportType,
          requestType: _requestType,
        );
  }

  Future<void> load({String? sportType, String? requestType}) async {
    _sportType = sportType;
    _requestType = requestType;
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(teamUpRepositoryProvider).getRequests(
            sportType: _sportType,
            requestType: _requestType,
          ),
    );
  }

  Future<void> refresh() =>
      load(sportType: _sportType, requestType: _requestType);
}

final teamUpNotifierProvider =
    AsyncNotifierProvider<TeamUpNotifier, List<TeamUpRequestModel>>(
        TeamUpNotifier.new);

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
