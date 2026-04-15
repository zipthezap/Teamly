import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:teamly_mobile/core/models/tournament_model.dart';
import 'package:teamly_mobile/features/tournaments/data/tournament_repository_impl.dart';
import 'package:teamly_mobile/features/tournaments/domain/tournament_repository.dart';
import 'package:teamly_mobile/features/tournaments/state/tournaments_notifier.dart';

class _FakeTournamentReadRepository implements TournamentReadRepository {
  _FakeTournamentReadRepository({
    required this.tournamentsResponses,
    required this.tournamentById,
  });

  final List<List<TournamentModel>> tournamentsResponses;
  final Map<String, TournamentModel> tournamentById;

  int getTournamentsCalls = 0;
  int getTournamentCalls = 0;

  @override
  Future<List<TournamentModel>> getTournaments({
    String? status,
    String? sportType,
    String? search,
  }) async {
    final index = getTournamentsCalls;
    getTournamentsCalls += 1;
    if (index >= tournamentsResponses.length) {
      return tournamentsResponses.last;
    }
    return tournamentsResponses[index];
  }

  @override
  Future<TournamentModel> getTournament(String id) async {
    getTournamentCalls += 1;
    final tournament = tournamentById[id];
    if (tournament == null) {
      throw StateError('Tournament not found: $id');
    }
    return tournament;
  }
}

TournamentModel _tournament(String id, String name) {
  return TournamentModel(
    id: id,
    name: name,
    sportType: 'soccer',
    format: 'pool',
    status: 'registration',
    createdAt: DateTime.utc(2024, 1, 1),
    creatorId: 'creator-1',
  );
}

void main() {
  test('tournaments notifier loads and reloads tournaments', () async {
    final first = _tournament('t1', 'Alpha Cup');
    final second = _tournament('t2', 'Beta Cup');
    final fakeRepo = _FakeTournamentReadRepository(
      tournamentsResponses: [
        [first],
        [first, second],
      ],
      tournamentById: {'t1': first, 't2': second},
    );

    final container = ProviderContainer(
      overrides: [
        tournamentReadRepositoryProvider.overrideWithValue(fakeRepo),
      ],
    );
    addTearDown(container.dispose);

    final initial = await container.read(tournamentsNotifierProvider.future);
    expect(initial, [first]);

    await container.read(tournamentsNotifierProvider.notifier).reload();
    expect(
      container.read(tournamentsNotifierProvider).requireValue,
      [first, second],
    );
    expect(fakeRepo.getTournamentsCalls, 2);
  });

  test('tournament detail provider returns tournament by id', () async {
    final tournament = _tournament('t42', 'Finals');
    final fakeRepo = _FakeTournamentReadRepository(
      tournamentsResponses: [
        [tournament],
      ],
      tournamentById: {'t42': tournament},
    );

    final container = ProviderContainer(
      overrides: [
        tournamentReadRepositoryProvider.overrideWithValue(fakeRepo),
      ],
    );
    addTearDown(container.dispose);

    final result = await container.read(tournamentDetailProvider('t42').future);
    expect(result, tournament);
    expect(fakeRepo.getTournamentCalls, 1);
  });

  test('tournament detail provider refreshes after invalidation', () async {
    final initialTournament = _tournament('t9', 'Spring Cup');
    final updatedTournament = TournamentModel(
      id: initialTournament.id,
      name: 'Spring Cup Updated',
      sportType: initialTournament.sportType,
      format: initialTournament.format,
      status: initialTournament.status,
      createdAt: initialTournament.createdAt,
      creatorId: initialTournament.creatorId,
    );

    final fakeRepo = _FakeTournamentReadRepository(
      tournamentsResponses: [
        [initialTournament],
      ],
      tournamentById: {'t9': initialTournament},
    );

    final container = ProviderContainer(
      overrides: [
        tournamentReadRepositoryProvider.overrideWithValue(fakeRepo),
      ],
    );
    addTearDown(container.dispose);

    final first = await container.read(tournamentDetailProvider('t9').future);
    expect(first.name, 'Spring Cup');
    expect(fakeRepo.getTournamentCalls, 1);

    fakeRepo.tournamentById['t9'] = updatedTournament;
    container.invalidate(tournamentDetailProvider('t9'));

    final refreshed = await container.read(tournamentDetailProvider('t9').future);
    expect(refreshed.name, 'Spring Cup Updated');
    expect(fakeRepo.getTournamentCalls, 2);
  });
}
