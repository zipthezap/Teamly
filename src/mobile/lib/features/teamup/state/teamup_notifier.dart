import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/teamup_model.dart';
import '../data/teamup_repository_impl.dart';

// ---------------------------------------------------------------------------
// Browse requests (with extended filter support)
// ---------------------------------------------------------------------------

class TeamUpNotifier extends AsyncNotifier<List<TeamUpRequestModel>> {
  String? _sportType;
  String? _requestType;
  String? _skillLevel;
  String? _city;
  String? _fromDate;
  String? _toDate;

  @override
  Future<List<TeamUpRequestModel>> build() {
    return ref.watch(teamUpRepositoryProvider).getRequests(
          sportType: _sportType,
          requestType: _requestType,
          skillLevel: _skillLevel,
          city: _city,
          fromDate: _fromDate,
          toDate: _toDate,
        );
  }

  Future<void> load({
    String? sportType,
    String? requestType,
    String? skillLevel,
    String? city,
    String? fromDate,
    String? toDate,
  }) async {
    _sportType = sportType;
    _requestType = requestType;
    _skillLevel = skillLevel;
    _city = city;
    _fromDate = fromDate;
    _toDate = toDate;
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(teamUpRepositoryProvider).getRequests(
            sportType: _sportType,
            requestType: _requestType,
            skillLevel: _skillLevel,
            city: _city,
            fromDate: _fromDate,
            toDate: _toDate,
          ),
    );
  }

  Future<void> refresh() => load(
        sportType: _sportType,
        requestType: _requestType,
        skillLevel: _skillLevel,
        city: _city,
        fromDate: _fromDate,
        toDate: _toDate,
      );
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
// My responses (responses others sent to MY requests — creator view)
// ---------------------------------------------------------------------------

final myTeamUpResponsesProvider =
    FutureProvider<List<TeamUpResponseModel>>((ref) async {
  return ref.watch(teamUpRepositoryProvider).getMyResponses();
});

// ---------------------------------------------------------------------------
// My applications (responses I submitted to others' requests — responder view)
// ---------------------------------------------------------------------------

final myTeamUpApplicationsProvider =
    FutureProvider<List<TeamUpApplicationModel>>((ref) async {
  return ref.watch(teamUpRepositoryProvider).getMyApplications();
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

// ---------------------------------------------------------------------------
// Comments for a specific request
// ---------------------------------------------------------------------------

final teamUpCommentsProvider =
    FutureProvider.family<List<TeamUpCommentModel>, String>((ref, id) async {
  return ref.watch(teamUpRepositoryProvider).getComments(id);
});
