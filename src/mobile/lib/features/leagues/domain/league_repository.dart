import '../../../core/models/league_model.dart';

abstract class LeagueRepository {
  Future<List<LeagueModel>> getLeagues({int page = 1, int limit = 20});
  Future<LeagueModel> getLeagueById(String leagueId);
  Future<LeagueModel> createLeague({
    required String name,
    required String sport,
    required bool isPublic,
    String? description,
    String? location,
  });
  Future<LeagueModel> updateLeague(String leagueId, Map<String, dynamic> updates);
  Future<void> deleteLeague(String leagueId);
  Future<void> joinLeague(String leagueId);
  Future<void> leaveLeague(String leagueId);
}
