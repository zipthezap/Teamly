import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/tournament_model.dart';
import '../data/tournament_repository_impl.dart';
import '../domain/tournament_repository.dart';

// ---------------------------------------------------------------------------
// Tournaments list
// ---------------------------------------------------------------------------

class TournamentsNotifier
    extends StateNotifier<AsyncValue<List<TournamentModel>>> {
  TournamentsNotifier(this._repo) : super(const AsyncValue.loading()) {
    load();
  }

  final TournamentRepository _repo;

  Future<void> load() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repo.getTournaments());
  }
}

final tournamentsNotifierProvider = StateNotifierProvider<TournamentsNotifier,
    AsyncValue<List<TournamentModel>>>(
  (ref) => TournamentsNotifier(ref.watch(tournamentRepositoryProvider)),
);

// ---------------------------------------------------------------------------
// Single tournament detail
// ---------------------------------------------------------------------------

final tournamentDetailProvider =
    FutureProvider.family<TournamentModel, String>((ref, id) async {
  return ref.watch(tournamentRepositoryProvider).getTournament(id);
});
