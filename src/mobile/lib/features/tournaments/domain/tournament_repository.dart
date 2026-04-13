import '../../../core/models/tournament_model.dart';

abstract class TournamentRepository {
  Future<List<TournamentModel>> getTournaments();
  Future<TournamentModel> getTournament(String id);
  Future<TournamentModel> createTournament(Map<String, dynamic> data);
  Future<void> addTeam(String tournamentId, Map<String, dynamic> data);

  // Captain self-registration
  Future<Map<String, dynamic>> selfRegisterTeam(
      String tournamentId, String teamName,
      {String? poolId});

  // Pool management
  Future<List<TournamentPoolModel>> getPools(String tournamentId);
  Future<TournamentPoolModel> createPool(
      String tournamentId, Map<String, dynamic> data);
  Future<Map<String, dynamic>> registerTeamToPool(
      String tournamentId, String poolId, String teamId);
  Future<void> removeTeamFromPool(
      String tournamentId, String poolId, String teamId);
  Future<void> removeTeamFromWaitlist(
      String tournamentId, String poolId, String teamId);

  // Category management
  Future<List<TournamentCategoryModel>> getCategories(String tournamentId);
  Future<TournamentCategoryModel> createCategory(
      String tournamentId, Map<String, dynamic> data);
  Future<TournamentCategoryModel> updateCategory(
      String tournamentId, String categoryId, Map<String, dynamic> data);
  Future<void> deleteCategory(String tournamentId, String categoryId);
  Future<void> assignPoolToCategory(
      String tournamentId, String poolId, String? categoryId);

  // Admin delegation
  Future<List<TournamentAdminModel>> getAdmins(String tournamentId);
  Future<TournamentAdminModel> addAdmin(
      String tournamentId, Map<String, dynamic> data);
  Future<void> removeAdmin(String tournamentId, String adminUserId);

  // Score submission
  Future<void> submitScore(String tournamentId, String matchId,
      {required int homeScore, required int awayScore});

  // Player management / invitations
  Future<void> sendInvitation(
      String tournamentId, String teamId, Map<String, dynamic> data);
  Future<List<Map<String, dynamic>>> getTeamInvitations(
      String tournamentId, String teamId);
  Future<List<Map<String, dynamic>>> getMyInvitations();
  Future<void> acceptInvitation(String inviteToken);
  Future<void> declineInvitation(String inviteToken);
  Future<void> cancelInvitation(
      String tournamentId, String teamId, String invitationId);

  // Players on a team
  Future<List<Map<String, dynamic>>> getPlayers(
      String tournamentId, String teamId);
  Future<void> removePlayer(
      String tournamentId, String teamId, String playerId);
}
