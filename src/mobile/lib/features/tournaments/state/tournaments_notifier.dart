import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/tournament_model.dart';
import '../../auth/state/auth_notifier.dart';
import '../data/tournament_repository_impl.dart';

// ---------------------------------------------------------------------------
// Tournaments list
// ---------------------------------------------------------------------------

class TournamentsNotifier extends AsyncNotifier<List<TournamentModel>> {
  @override
  Future<List<TournamentModel>> build() {
    return ref.watch(tournamentReadRepositoryProvider).getTournaments();
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(tournamentReadRepositoryProvider).getTournaments(),
    );
  }
}

final tournamentsNotifierProvider =
    AsyncNotifierProvider<TournamentsNotifier, List<TournamentModel>>(
        TournamentsNotifier.new);

// ---------------------------------------------------------------------------
// Single tournament detail
// ---------------------------------------------------------------------------

final tournamentDetailProvider =
    FutureProvider.family<TournamentModel, String>((ref, id) async {
  return ref.watch(tournamentReadRepositoryProvider).getTournament(id);
});

// ---------------------------------------------------------------------------
// My invitations count
// ---------------------------------------------------------------------------

final myInvitationsCountProvider =
    FutureProvider<int>((ref) async {
  final authState = ref.watch(authNotifierProvider);
  if (!authState.isAuthenticated || authState.user == null) {
    // No authenticated user context yet; avoid hitting a protected endpoint.
    return 0;
  }

  try {
    final invites = await ref.watch(tournamentRepositoryProvider).getMyInvitations();
    return invites.where((i) => (i['status'] as String?) == 'pending').length;
  } on DioException catch (e) {
    // Swallow network / server errors so the badge degrades gracefully
    debugPrint('myInvitationsCountProvider: network error ignored: $e');
    return 0;
  } on AppException catch (e) {
    // Swallow auth/app-level errors (e.g. 401 User not found on stale session)
    debugPrint('myInvitationsCountProvider: app error ignored: $e');
    return 0;
  } catch (e) {
    // Re-throw unexpected errors (programming bugs, type errors, etc.)
    rethrow;
  }
});

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

final tournamentAnnouncementsProvider =
    FutureProvider.family<List<TournamentAnnouncementModel>, String>(
        (ref, tournamentId) async {
  return ref.watch(tournamentRepositoryProvider).getAnnouncements(tournamentId);
});

// ---------------------------------------------------------------------------
// Analytics (organizer only)
// ---------------------------------------------------------------------------

final tournamentAnalyticsProvider =
    FutureProvider.family<TournamentAnalyticsModel, String>(
        (ref, tournamentId) async {
  return ref.watch(tournamentRepositoryProvider).getTournamentAnalytics(tournamentId);
});

// ---------------------------------------------------------------------------
// Registration fields
// ---------------------------------------------------------------------------

final tournamentRegistrationFieldsProvider =
    FutureProvider.family<List<TournamentRegistrationFieldModel>, String>(
        (ref, tournamentId) async {
  return ref.watch(tournamentRepositoryProvider).getRegistrationFields(tournamentId);
});

// ---------------------------------------------------------------------------
// Registration waitlist
// ---------------------------------------------------------------------------

final tournamentRegistrationWaitlistProvider =
    FutureProvider.family<List<TournamentRegistrationWaitlistModel>, String>(
        (ref, tournamentId) async {
  return ref
      .watch(tournamentRepositoryProvider)
      .getRegistrationWaitlist(tournamentId);
});

// ---------------------------------------------------------------------------
// Courts
// ---------------------------------------------------------------------------

final tournamentCourtsProvider =
    FutureProvider.family<List<TournamentCourtModel>, String>((ref, tournamentId) async {
  return ref.watch(tournamentRepositoryProvider).getCourts(tournamentId);
});
