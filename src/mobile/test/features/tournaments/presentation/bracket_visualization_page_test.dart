import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/tournament_model.dart';
import 'package:teamly_mobile/features/tournaments/presentation/bracket_visualization_page.dart';

TournamentModel _buildTournament(
  List<TournamentMatchModel> matches, {
  List<TournamentStandingModel> standings = const [],
}) {
  return TournamentModel(
    id: 'tournament-1',
    name: 'Summer Cup',
    sportType: 'football',
    format: 'groups_knockout',
    status: 'in_progress',
    createdAt: DateTime(2025, 1, 1),
    creatorId: 'user-1',
    matches: matches,
    standings: standings,
  );
}

TournamentMatchModel _groupMatch({
  required String id,
  required String groupName,
  required String home,
  required String away,
  String status = 'scheduled',
  int? scoreA,
  int? scoreB,
}) {
  return TournamentMatchModel(
    id: id,
    tournamentId: 'tournament-1',
    round: groupName,
    status: status,
    stage: 'group_stage',
    groupName: groupName,
    teamAName: home,
    teamBName: away,
    scoreA: scoreA,
    scoreB: scoreB,
  );
}

TournamentMatchModel _playoffMatch({
  required int seedA,
  required int seedB,
  required int order,
  String status = 'scheduled',
  int? scoreA,
  int? scoreB,
}) {
  return TournamentMatchModel(
    id: 'playoff-$order',
    tournamentId: 'tournament-1',
    round: 'Playoffs',
    status: status,
    stage: 'round_of_16',
    roundNumber: 1,
    matchOrder: order,
    teamAName: 'Seed $seedA',
    teamBName: 'Seed $seedB',
    scoreA: scoreA,
    scoreB: scoreB,
  );
}

void main() {
  testWidgets('groups knockout projects a playoff bracket from standings before knockout exists',
      (tester) async {
    final tournament = _buildTournament([
      _groupMatch(
        id: 'group-1',
        groupName: 'Group A',
        home: 'Alpha',
        away: 'Bravo',
      ),
    ], standings: const [
      TournamentStandingModel(
        id: 's1',
        teamId: 't1',
        teamName: 'Lightning FC',
        points: 9,
        wins: 3,
        losses: 0,
        draws: 0,
        goalsFor: 8,
        goalsAgainst: 1,
        groupName: 'Group A',
      ),
      TournamentStandingModel(
        id: 's2',
        teamId: 't2',
        teamName: 'Victory Vipers',
        points: 6,
        wins: 2,
        losses: 1,
        draws: 0,
        goalsFor: 6,
        goalsAgainst: 3,
        groupName: 'Group A',
      ),
      TournamentStandingModel(
        id: 's3',
        teamId: 't3',
        teamName: 'Storm Chasers',
        points: 9,
        wins: 3,
        losses: 0,
        draws: 0,
        goalsFor: 7,
        goalsAgainst: 2,
        groupName: 'Group B',
      ),
      TournamentStandingModel(
        id: 's4',
        teamId: 't4',
        teamName: 'Champion Chiefs',
        points: 6,
        wins: 2,
        losses: 1,
        draws: 0,
        goalsFor: 5,
        goalsAgainst: 4,
        groupName: 'Group B',
      ),
    ]);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: TournamentBracketView(tournament: tournament)),
      ),
    );

    expect(find.text('Projected Playoffs'), findsOneWidget);
    expect(find.text('Semifinals'), findsOneWidget);
    expect(find.text('Finals'), findsOneWidget);
    expect(find.text('Lightning FC'), findsWidgets);
    expect(find.text('Storm Chasers'), findsWidgets);
  });

  testWidgets('groups knockout renders named stage columns and advancing winners', (tester) async {
    final tournament = _buildTournament([
      _groupMatch(
        id: 'group-1',
        groupName: 'Group A',
        home: 'Alpha',
        away: 'Bravo',
        status: 'completed',
        scoreA: 2,
        scoreB: 1,
      ),
      _playoffMatch(seedA: 1, seedB: 16, order: 1, status: 'completed', scoreA: 3, scoreB: 1),
      _playoffMatch(seedA: 8, seedB: 9, order: 2),
      _playoffMatch(seedA: 5, seedB: 12, order: 3),
      _playoffMatch(seedA: 4, seedB: 13, order: 4),
      _playoffMatch(seedA: 6, seedB: 11, order: 5),
      _playoffMatch(seedA: 3, seedB: 14, order: 6),
      _playoffMatch(seedA: 7, seedB: 10, order: 7),
      _playoffMatch(seedA: 2, seedB: 15, order: 8),
    ]);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: TournamentBracketView(tournament: tournament)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Playoffs'), findsOneWidget);
    expect(find.text('Quarterfinals'), findsOneWidget);
    expect(find.text('Semifinals'), findsOneWidget);
    expect(find.text('Finals'), findsOneWidget);
    expect(find.text('Seed 1'), findsWidgets);
  });
}
