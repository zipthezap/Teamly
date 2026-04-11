import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/league_model.dart';
import '../data/league_repository_impl.dart';
import '../domain/league_repository.dart';

export '../data/league_repository_impl.dart' show leagueRepositoryProvider;

final leaguesNotifierProvider =
    AsyncNotifierProvider<LeaguesNotifier, List<LeagueModel>>(LeaguesNotifier.new);

class LeaguesNotifier extends AsyncNotifier<List<LeagueModel>> {
  @override
  Future<List<LeagueModel>> build() async {
    return ref.watch(leagueRepositoryProvider).getLeagues();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(leagueRepositoryProvider).getLeagues(),
    );
  }

  Future<void> joinLeague(String leagueId) async {
    await ref.read(leagueRepositoryProvider).joinLeague(leagueId);
    await refresh();
  }

  Future<void> leaveLeague(String leagueId) async {
    await ref.read(leagueRepositoryProvider).leaveLeague(leagueId);
    await refresh();
  }
}

final leagueDetailProvider =
    FutureProvider.family<LeagueModel, String>((ref, leagueId) async {
  return ref.watch(leagueRepositoryProvider).getLeagueById(leagueId);
});

final leagueStandingsProvider =
    FutureProvider.family<List<LeagueStandingModel>, String>(
        (ref, leagueId) async {
  return ref.watch(leagueRepositoryProvider).getStandings(leagueId);
});
