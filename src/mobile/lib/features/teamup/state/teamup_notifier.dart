import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/models/teamup_model.dart';
import '../data/teamup_repository_impl.dart';

class NearbyLocationPermissionException implements Exception {
  const NearbyLocationPermissionException({required this.deniedForever});

  final bool deniedForever;

  @override
  String toString() {
    return deniedForever
        ? 'Location access is permanently denied. Enable location permission in system settings or use city fallback.'
        : 'Location permission is required to browse nearby TeamUps. You can grant permission or use city fallback.';
  }
}

// ---------------------------------------------------------------------------
// Browse requests (with extended filter support and cursor pagination)
// ---------------------------------------------------------------------------

class TeamUpNotifier extends AsyncNotifier<List<TeamUpRequestModel>> {
  String? _sportType;
  String? _requestType;
  String? _skillLevel;
  String? _city;
  String? _search;
  String? _fromDate;
  String? _toDate;

  String? _nextCursor;
  bool _hasMore = false;
  bool _loadingMore = false;

  bool get hasMore => _hasMore;

  @override
  Future<List<TeamUpRequestModel>> build() async {
    _nextCursor = null;
    _hasMore = false;
    final result = await ref.watch(teamUpRepositoryProvider).getRequests(
          sportType: _sportType,
          requestType: _requestType,
          skillLevel: _skillLevel,
          city: _city,
          search: _search,
          fromDate: _fromDate,
          toDate: _toDate,
        );
    _nextCursor = result.nextCursor;
    _hasMore = result.hasMore;
    return result.data;
  }

  Future<void> load({
    String? sportType,
    String? requestType,
    String? skillLevel,
    String? city,
    String? search,
    String? fromDate,
    String? toDate,
  }) async {
    _sportType = sportType;
    _requestType = requestType;
    _skillLevel = skillLevel;
    _city = city;
    _search = search;
    _fromDate = fromDate;
    _toDate = toDate;
    _nextCursor = null;
    _hasMore = false;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final result = await ref.read(teamUpRepositoryProvider).getRequests(
            sportType: _sportType,
            requestType: _requestType,
            skillLevel: _skillLevel,
            city: _city,
            search: _search,
            fromDate: _fromDate,
            toDate: _toDate,
          );
      _nextCursor = result.nextCursor;
      _hasMore = result.hasMore;
      return result.data;
    });
  }

  Future<void> loadMore() async {
    if (!_hasMore || _nextCursor == null || _loadingMore) return;
    final current = state.valueOrNull;
    if (current == null) return;

    _loadingMore = true;
    try {
      final result = await ref.read(teamUpRepositoryProvider).getRequests(
            sportType: _sportType,
            requestType: _requestType,
            skillLevel: _skillLevel,
            city: _city,
            search: _search,
            fromDate: _fromDate,
            toDate: _toDate,
            cursor: _nextCursor,
          );
      _nextCursor = result.nextCursor;
      _hasMore = result.hasMore;
      state = AsyncData([...current, ...result.data]);
    } finally {
      _loadingMore = false;
    }
  }

  Future<void> refresh() => load(
        sportType: _sportType,
        requestType: _requestType,
        skillLevel: _skillLevel,
        city: _city,
        search: _search,
        fromDate: _fromDate,
        toDate: _toDate,
      );
}

final teamUpNotifierProvider =
    AsyncNotifierProvider<TeamUpNotifier, List<TeamUpRequestModel>>(
        TeamUpNotifier.new);

final nearbyTeamUpRequestsProvider =
    FutureProvider<List<TeamUpRequestModel>>((ref) async {
  final permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    final requested = await Geolocator.requestPermission();
    if (requested == LocationPermission.denied ||
        requested == LocationPermission.deniedForever) {
      throw NearbyLocationPermissionException(
        deniedForever: requested == LocationPermission.deniedForever,
      );
    }
  } else if (permission == LocationPermission.deniedForever) {
    throw const NearbyLocationPermissionException(deniedForever: true);
  }

  final position = await Geolocator.getCurrentPosition();
  return ref.watch(teamUpRepositoryProvider).getNearbyRequests(
        latitude: position.latitude,
        longitude: position.longitude,
      );
});

final nearbyTeamUpRequestsByCityProvider =
    FutureProvider.family<List<TeamUpRequestModel>, String>((ref, city) async {
  final result =
      await ref.watch(teamUpRepositoryProvider).getRequests(city: city);
  return result.data;
});

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

// ---------------------------------------------------------------------------
// Attendance history
// ---------------------------------------------------------------------------

final teamUpAttendanceHistoryProvider =
    FutureProvider<TeamUpAttendanceHistoryModel>((ref) async {
  return ref.watch(teamUpRepositoryProvider).getAttendanceHistory();
});

// ---------------------------------------------------------------------------
// Saved searches
// ---------------------------------------------------------------------------

final teamUpSavedSearchesProvider =
    FutureProvider<List<TeamUpSavedSearchModel>>((ref) async {
  return ref.watch(teamUpRepositoryProvider).listSavedSearches();
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

final teamUpAnalyticsProvider =
    FutureProvider<TeamUpAnalyticsModel>((ref) async {
  return ref.watch(teamUpRepositoryProvider).getTeamUpAnalytics();
});

// ---------------------------------------------------------------------------
// Replacement suggestions for a request
// ---------------------------------------------------------------------------

final teamUpReplacementSuggestionsProvider =
    FutureProvider.family<List<TeamUpReplacementSuggestionModel>, String>(
        (ref, requestId) async {
  return ref
      .watch(teamUpRepositoryProvider)
      .getReplacementSuggestions(requestId);
});
