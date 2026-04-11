import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/tournament_model.dart';
import '../data/tournament_repository_impl.dart';

// ---------------------------------------------------------------------------
// Tournaments list
// ---------------------------------------------------------------------------

class TournamentsNotifier extends AsyncNotifier<List<TournamentModel>> {
  @override
  Future<List<TournamentModel>> build() {
    return ref.watch(tournamentRepositoryProvider).getTournaments();
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(tournamentRepositoryProvider).getTournaments(),
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
  return ref.watch(tournamentRepositoryProvider).getTournament(id);
});
