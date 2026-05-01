import '../../../core/models/tournament_model.dart';

abstract class TournamentReadRepository {
  Future<List<TournamentModel>> getTournaments({String? status, String? sportType, String? search});
  Future<TournamentModel> getTournament(String id);
}

abstract class TournamentWriteRepository {
  Future<TournamentModel> createTournament(Map<String, dynamic> data);
  Future<TournamentModel> updateTournament(String id, Map<String, dynamic> data);
}

abstract class TeamRegistrationRepository {
  Future<void> addTeam(String tournamentId, Map<String, dynamic> data);

  Future<Map<String, dynamic>> selfRegisterTeam(
      String tournamentId, String teamName,
      {String? poolId, String? categoryId});
  Future<void> selfUnregisterTeam(String tournamentId);
  Future<List<Map<String, dynamic>>> getPlayers(
      String tournamentId, String teamId);
  Future<void> removePlayer(
      String tournamentId, String teamId, String playerId);
}

abstract class PoolRepository {
  Future<List<TournamentPoolModel>> getPools(String tournamentId);
  Future<TournamentPoolModel> createPool(
      String tournamentId, Map<String, dynamic> data);
  Future<TournamentPoolModel> updatePool(
      String tournamentId, String poolId, Map<String, dynamic> data);
  Future<void> deletePool(String tournamentId, String poolId);
  Future<Map<String, dynamic>> registerTeamToPool(
      String tournamentId, String poolId, String teamId);
  Future<void> removeTeamFromPool(
      String tournamentId, String poolId, String teamId);
  Future<void> removeTeamFromWaitlist(
      String tournamentId, String poolId, String teamId);
}

abstract class CategoryRepository {
  Future<List<TournamentCategoryModel>> getCategories(String tournamentId);
  Future<TournamentCategoryModel> createCategory(
      String tournamentId, Map<String, dynamic> data);
  Future<TournamentCategoryModel> updateCategory(
      String tournamentId, String categoryId, Map<String, dynamic> data);
  Future<void> deleteCategory(String tournamentId, String categoryId);
  Future<void> assignPoolToCategory(
      String tournamentId, String poolId, String? categoryId);
}

abstract class AdminRepository {
  Future<List<TournamentAdminModel>> getAdmins(String tournamentId);
  Future<TournamentAdminModel> addAdmin(
      String tournamentId, Map<String, dynamic> data);
  Future<void> removeAdmin(String tournamentId, String adminUserId);
}

abstract class InvitationRepository {
  Future<void> sendInvitation(
      String tournamentId, String teamId, Map<String, dynamic> data);
  Future<List<Map<String, dynamic>>> getTeamInvitations(
      String tournamentId, String teamId);
  Future<List<Map<String, dynamic>>> getMyInvitations();
  Future<void> acceptInvitation(String inviteToken);
  Future<void> declineInvitation(String inviteToken);
  Future<void> cancelInvitation(
      String tournamentId, String teamId, String invitationId);
  Future<Map<String, dynamic>> getInvitationDetails(String inviteToken);
}

abstract class MatchRepository {
  Future<void> submitScore(String tournamentId, String matchId,
      {required int homeScore, required int awayScore});
  Future<void> createMatch(String tournamentId, Map<String, dynamic> data);
  Future<void> updateMatch(String tournamentId, String matchId, Map<String, dynamic> data);
  Future<void> deleteMatch(String tournamentId, String matchId);

  // Bracket generation
  Future<Map<String, dynamic>> generateBrackets(String tournamentId, {int? numberOfGroups});
}

abstract class TournamentRepository
    implements
        TournamentReadRepository,
        TournamentWriteRepository,
        TeamRegistrationRepository,
        PoolRepository,
        CategoryRepository,
        AdminRepository,
        InvitationRepository,
        MatchRepository {}
