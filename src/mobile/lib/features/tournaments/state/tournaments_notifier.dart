import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/tournament_model.dart';
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
  try {
    final invites = await ref.watch(tournamentRepositoryProvider).getMyInvitations();
    return invites.where((i) => (i['status'] as String?) == 'pending').length;
  } catch (_) {
    return 0;
  }
});
