import '../../../core/models/tournament_model.dart';

abstract class TournamentReadRepository {
  Future<List<TournamentModel>> getTournaments(
      {String? status, String? sportType, String? search});
  Future<TournamentModel> getTournament(String id);
}

abstract class TournamentWriteRepository {
  Future<TournamentModel> createTournament(Map<String, dynamic> data);
  Future<TournamentModel> updateTournament(
      String id, Map<String, dynamic> data);
  Future<void> deleteTournament(String id);
  Future<void> cancelTournament(String id);

  /// Clone a tournament structure into a new draft tournament owned by the
  /// current user.  Returns the newly created tournament.
  Future<TournamentModel> cloneTournament(String tournamentId);
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
  Future<Map<String, dynamic>> generateCheckInQrToken(
      String tournamentId, String teamId);
  Future<Map<String, dynamic>> checkInViaQrToken(
      String tournamentId, String token);

  /// Manually check in a team (organizer/admin action).
  Future<void> checkInTeam(String tournamentId, String teamId);

  /// Accept the tournament waiver on behalf of the registering team.
  Future<void> acceptTeamWaiver(String tournamentId, String teamId);
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
  Future<Map<String, dynamic>> registerTeamToPoolAsAdmin(
      String tournamentId, String poolId, String teamId);
  Future<void> moveTeamToPoolAsAdmin(String tournamentId, String sourcePoolId,
      String teamId, String targetPoolId);
  Future<void> removeTeamFromPool(
      String tournamentId, String poolId, String teamId);
  Future<void> removeTeamFromPoolAsAdmin(
      String tournamentId, String poolId, String teamId);
  Future<void> removeTeamFromWaitlist(
      String tournamentId, String poolId, String teamId);

  /// Move (or unassign) a team to the given pool. Pass null to just remove from
  /// the current pool. Returns the raw response map from the backend.
  Future<Map<String, dynamic>> moveTeamToPool(
      String tournamentId, String teamId, String? poolId);
  Future<void> removeTeamFromWaitlistAsAdmin(
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
  Future<Map<String, dynamic>> updateTeamPayment(
      String tournamentId, String teamId, String paymentStatus);
  Future<Map<String, dynamic>> batchUpdateTeamPayment(
      String tournamentId, List<String> teamIds, String paymentStatus);
  Future<void> deleteTeam(String tournamentId, String teamId);
}

abstract class InvitationRepository {
  Future<void> sendInvitation(
      String tournamentId, String teamId, Map<String, dynamic> data);
  Future<List<Map<String, dynamic>>> getTeamInvitations(
      String tournamentId, String teamId);
  Future<List<Map<String, dynamic>>> getMyInvitations();
  Future<void> acceptInvitation(String inviteToken);
  Future<void> declineInvitation(String inviteToken);
  Future<Map<String, dynamic>> getInvitation(String inviteToken);
  Future<void> cancelInvitation(
      String tournamentId, String teamId, String invitationId);
  Future<Map<String, dynamic>> getInvitationDetails(String inviteToken);
}

abstract class MatchRepository {
  Future<void> submitScore(String tournamentId, String matchId,
      {required int homeScore, required int awayScore});
  Future<void> adminUpdateScore(String tournamentId, String matchId,
      {required int homeScore, required int awayScore});
  Future<void> createMatch(String tournamentId, Map<String, dynamic> data);
  Future<void> updateMatch(
      String tournamentId, String matchId, Map<String, dynamic> data);
  Future<void> deleteMatch(String tournamentId, String matchId);
  Future<void> assignReferee(
      String tournamentId, String matchId, String? refereeTeamId);
  Future<Map<String, dynamic>> autoAssignReferees(
    String tournamentId, {
    int? roundNumber,
    String? groupName,
    String? stage,
  });
  Future<List<RefereeDutyModel>> getRefereeDuties(String tournamentId);
  Future<void> assignScorekeeper(
      String tournamentId, String matchId, String? scorekeeperUserId);
  Future<void> startMatch(String tournamentId, String matchId);
  Future<List<Map<String, dynamic>>> getMatchIncidents(
      String tournamentId, String matchId);
  Future<Map<String, dynamic>> createMatchIncident(
    String tournamentId,
    String matchId, {
    String? incidentType,
    required String description,
    int? slaMinutes,
  });
  Future<Map<String, dynamic>> resolveMatchIncident(
    String tournamentId,
    String incidentId, {
    required String status,
    String? resolution,
  });

  // Bracket generation
  Future<Map<String, dynamic>> generateBrackets(String tournamentId,
      {int? numberOfGroups,
      int? teamsPerGroup,
      int? playoffSize,
      bool? doubleElimination,
      bool usePoolAssignments = false,
      bool forceGenerate = false});

  /// Generate group-stage matches (groups_knockout only, post-registration-close).
  Future<Map<String, dynamic>> generateGroupMatches(
    String tournamentId, {
    int? numberOfGroups,
    int? teamsPerGroup,
    bool usePoolAssignments = false,
    bool forceGenerate = false,
    DateTime? scheduleStartAt,
    int? gameDurationMinutes,
    int? warmupMinutes,
    int? breakMinutes,
    int? minTeamRestMinutes,
  });
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

abstract class AnnouncementRepository {
  Future<List<TournamentAnnouncementModel>> getAnnouncements(
      String tournamentId);
  Future<TournamentAnnouncementModel> createAnnouncement(String tournamentId,
      {required String title, required String body, bool isPinned = false});
  Future<TournamentAnnouncementModel> updateAnnouncement(
      String tournamentId, String announcementId,
      {String? title, String? body, bool? isPinned});
  Future<void> deleteAnnouncement(String tournamentId, String announcementId);
}

// ---------------------------------------------------------------------------
// Registration fields
// ---------------------------------------------------------------------------

abstract class RegistrationFieldRepository {
  Future<List<TournamentRegistrationFieldModel>> getRegistrationFields(
      String tournamentId);
  Future<TournamentRegistrationFieldModel> createRegistrationField(
      String tournamentId, Map<String, dynamic> data);
  Future<TournamentRegistrationFieldModel> updateRegistrationField(
      String tournamentId, String fieldId, Map<String, dynamic> data);
  Future<void> deleteRegistrationField(String tournamentId, String fieldId);
}

// ---------------------------------------------------------------------------
// Registration waitlist
// ---------------------------------------------------------------------------

abstract class RegistrationWaitlistRepository {
  Future<List<TournamentRegistrationWaitlistModel>> getRegistrationWaitlist(
      String tournamentId);
  Future<void> joinRegistrationWaitlist(String tournamentId, String teamName);
  Future<void> leaveRegistrationWaitlist(String tournamentId);
  Future<void> promoteFromRegistrationWaitlist(
      String tournamentId, String entryId);
  Future<void> removeFromRegistrationWaitlist(
      String tournamentId, String entryId);
}

// ---------------------------------------------------------------------------
// Courts (Phase 3 - Game-day scheduling)
// ---------------------------------------------------------------------------

abstract class CourtRepository {
  Future<List<TournamentCourtModel>> getCourts(String tournamentId);
  Future<TournamentCourtModel> createCourt(String tournamentId,
      {required String name, String? location});
  Future<TournamentCourtModel> updateCourt(
      String tournamentId, String courtId, Map<String, dynamic> data);
  Future<void> deleteCourt(String tournamentId, String courtId);
  Future<void> scheduleMatchOnCourt(
      String tournamentId, String matchId, String courtId,
      {DateTime? scheduledAt, int? durationMinutes});
}

// ---------------------------------------------------------------------------
// Score disputes
// ---------------------------------------------------------------------------

abstract class ScoreDisputeRepository {
  Future<List<TournamentScoreDisputeModel>> getMatchDisputes(
      String tournamentId, String matchId);
  Future<TournamentScoreDisputeModel> createScoreDispute(
      String tournamentId, String matchId,
      {required String reason});
  Future<void> resolveScoreDispute(String tournamentId, String disputeId,
      {required String status, String? resolution});
}

// ---------------------------------------------------------------------------
// Analytics & portal (Phase 4 + 5)
// ---------------------------------------------------------------------------

abstract class AnalyticsRepository {
  Future<TournamentAnalyticsModel> getTournamentAnalytics(String tournamentId);
  Future<String> generateShareToken(String tournamentId);
  Future<Map<String, dynamic>> getPublicPortal(String shareToken);
}

// ---------------------------------------------------------------------------
// Composite repository interface
// ---------------------------------------------------------------------------

abstract class TournamentRepository
    implements
        TournamentReadRepository,
        TournamentWriteRepository,
        TeamRegistrationRepository,
        PoolRepository,
        CategoryRepository,
        AdminRepository,
        InvitationRepository,
        MatchRepository,
        AnnouncementRepository,
        RegistrationFieldRepository,
        RegistrationWaitlistRepository,
        CourtRepository,
        ScoreDisputeRepository,
        AnalyticsRepository {}
