import '../../../core/models/league_model.dart';

abstract class LeagueRepository {
  Future<List<LeagueModel>> getLeagues({int page = 1, int limit = 20, String? groupId});
  Future<LeagueModel> getLeagueById(String leagueId);
  Future<LeagueModel> createLeague({
    required String title,
    required String sport,
    required bool isPublic,
    required String groupId,
    required DateTime startDate,
    required LeagueScheduleType scheduleType,
    String? description,
    String? location,
    int? sessionCount,
    int? maxTeams,
    DateTime? endDate,
  });
  Future<LeagueModel> updateLeague(String leagueId, Map<String, dynamic> updates);
  Future<void> deleteLeague(String leagueId);
  Future<void> joinLeague(String leagueId);
  Future<void> leaveLeague(String leagueId);

  // Teams
  Future<List<LeagueTeamModel>> getTeams(String leagueId);
  Future<LeagueTeamModel> addTeam(String leagueId, String name, {String? captainUserId});
  Future<void> removeTeam(String leagueId, String teamId);

  // Standings
  Future<List<LeagueStandingModel>> getStandings(String leagueId);

  // Sessions
  Future<void> linkSession(String leagueId, String sessionId, {int? roundNumber});

  // Matches
  Future<void> recordMatchResult(
    String leagueId,
    String matchId, {
    required int homeScore,
    required int awayScore,
  });
}
