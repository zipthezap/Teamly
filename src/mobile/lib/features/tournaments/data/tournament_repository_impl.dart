import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/tournament_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/tournament_repository.dart';

class TournamentRepositoryImpl implements TournamentRepository {
  TournamentRepositoryImpl(this._dio);

  final Dio _dio;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  List<dynamic> _extractList(dynamic data, [List<String> keys = const []]) {
    if (data is List) return data;
    if (data is Map<String, dynamic>) {
      for (final key in keys) {
        if (data[key] is List) return data[key] as List<dynamic>;
      }
    }
    return [];
  }

  Map<String, dynamic> _requireMapData(
    Response<Map<String, dynamic>> response,
    String operation,
  ) {
    final data = response.data;
    if (data == null) {
      throw FormatException('Empty response payload for $operation');
    }
    return data;
  }

  // ---------------------------------------------------------------------------
  // Tournament CRUD
  // ---------------------------------------------------------------------------

  @override
  Future<List<TournamentModel>> getTournaments({String? status, String? sportType, String? search}) async {
    final queryParams = <String, dynamic>{};
    if (status != null) queryParams['status'] = status;
    if (sportType != null) queryParams['sportType'] = sportType;
    if (search != null && search.trim().isNotEmpty) {
      queryParams['search'] = search.trim();
    }
    final response = await _dio.get<dynamic>(
      '/tournaments',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );
    final items = _extractList(response.data, ['tournaments', 'data']);
    final tournaments = items
        .map((e) => TournamentModel.fromJson(e as Map<String, dynamic>))
        .toList();
    return tournaments;
  }

  @override
  Future<TournamentModel> getTournament(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/tournaments/$id');
    return TournamentModel.fromJson(_requireMapData(response, 'get tournament'));
  }

  @override
  Future<TournamentModel> createTournament(Map<String, dynamic> data) async {
    final response =
        await _dio.post<Map<String, dynamic>>('/tournaments', data: data);
    return TournamentModel.fromJson(_requireMapData(response, 'create tournament'));
  }

  @override
  Future<void> addTeam(String tournamentId, Map<String, dynamic> data) async {
    await _dio.post<void>('/tournaments/$tournamentId/teams', data: data);
  }

  // ---------------------------------------------------------------------------
  // Captain self-registration
  // ---------------------------------------------------------------------------

  @override
  Future<Map<String, dynamic>> selfRegisterTeam(
    String tournamentId,
    String teamName, {
    String? poolId,
    String? categoryId,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/tournaments/$tournamentId/teams/self-register',
      data: {
        'name': teamName,
        if (poolId != null) 'poolId': poolId,
        if (categoryId != null) 'categoryId': categoryId,
      },
    );
    return _requireMapData(response, 'self register team');
  }

  @override
  Future<void> selfUnregisterTeam(String tournamentId) async {
    await _dio.delete<void>('/tournaments/$tournamentId/teams/self-register');
  }

  // ---------------------------------------------------------------------------
  // Pool management
  // ---------------------------------------------------------------------------

  @override
  Future<List<TournamentPoolModel>> getPools(String tournamentId) async {
    final response =
        await _dio.get<dynamic>('/tournaments/$tournamentId/pools');
    final items = _extractList(response.data, ['data']);
    return items
        .map((e) =>
            TournamentPoolModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TournamentPoolModel> createPool(
      String tournamentId, Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>(
        '/tournaments/$tournamentId/pools',
        data: data);
    return TournamentPoolModel.fromJson(_requireMapData(response, 'create pool'));
  }

  @override
  Future<TournamentPoolModel> updatePool(
      String tournamentId, String poolId, Map<String, dynamic> data) async {
    final response = await _dio.put<Map<String, dynamic>>(
        '/tournaments/$tournamentId/pools/$poolId',
        data: data);
    return TournamentPoolModel.fromJson(_requireMapData(response, 'update pool'));
  }

  @override
  Future<void> deletePool(String tournamentId, String poolId) async {
    await _dio.delete<void>('/tournaments/$tournamentId/pools/$poolId');
  }

  @override
  Future<Map<String, dynamic>> registerTeamToPool(
      String tournamentId, String poolId, String teamId) async {
    final response = await _dio.post<Map<String, dynamic>>(
        '/tournaments/$tournamentId/pools/$poolId/teams/$teamId');
    return _requireMapData(response, 'register team to pool');
  }

  @override
  Future<Map<String, dynamic>> registerTeamToPoolAsAdmin(
      String tournamentId, String poolId, String teamId) async {
    final response = await _dio.post<Map<String, dynamic>>(
        '/tournaments/$tournamentId/pools/$poolId/admin/teams/$teamId');
    return _requireMapData(response, 'register team to pool (admin)');
  }

  @override
  Future<void> removeTeamFromPool(
      String tournamentId, String poolId, String teamId) async {
    await _dio.delete<void>(
        '/tournaments/$tournamentId/pools/$poolId/teams/$teamId');
  }

  @override
  Future<void> removeTeamFromPoolAsAdmin(
      String tournamentId, String poolId, String teamId) async {
    await _dio.delete<void>(
        '/tournaments/$tournamentId/pools/$poolId/admin/teams/$teamId');
  }

  @override
  Future<void> moveTeamToPoolAsAdmin(
      String tournamentId, String sourcePoolId, String teamId, String targetPoolId) async {
    await _dio.post<void>(
      '/tournaments/$tournamentId/pools/$sourcePoolId/admin/teams/$teamId/move/$targetPoolId'
    );
  }

  @override
  Future<void> removeTeamFromWaitlist(
      String tournamentId, String poolId, String teamId) async {
    await _dio.delete<void>(
        '/tournaments/$tournamentId/pools/$poolId/waitlist/$teamId');
  }

  @override
  Future<Map<String, dynamic>> moveTeamToPool(
      String tournamentId, String teamId, String? poolId) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/tournaments/$tournamentId/teams/$teamId/pool-move',
      data: {'poolId': poolId},
    );
    return response.data ?? {};
  }

  @override
  Future<void> removeTeamFromWaitlistAsAdmin(
      String tournamentId, String poolId, String teamId) async {
    await _dio.delete<void>(
        '/tournaments/$tournamentId/pools/$poolId/waitlist/$teamId/admin');
  }

  // ---------------------------------------------------------------------------
  // Category management
  // ---------------------------------------------------------------------------

  @override
  Future<List<TournamentCategoryModel>> getCategories(
      String tournamentId) async {
    final response =
        await _dio.get<dynamic>('/tournaments/$tournamentId/categories');
    final items = _extractList(response.data, ['data']);
    return items
        .map((e) =>
            TournamentCategoryModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TournamentCategoryModel> createCategory(
      String tournamentId, Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>(
        '/tournaments/$tournamentId/categories',
        data: data);
    return TournamentCategoryModel.fromJson(
      _requireMapData(response, 'create category'),
    );
  }

  @override
  Future<TournamentCategoryModel> updateCategory(
      String tournamentId, String categoryId, Map<String, dynamic> data) async {
    final response = await _dio.put<Map<String, dynamic>>(
        '/tournaments/$tournamentId/categories/$categoryId',
        data: data);
    return TournamentCategoryModel.fromJson(
      _requireMapData(response, 'update category'),
    );
  }

  @override
  Future<void> deleteCategory(
      String tournamentId, String categoryId) async {
    await _dio.delete<void>(
        '/tournaments/$tournamentId/categories/$categoryId');
  }

  @override
  Future<void> assignPoolToCategory(
      String tournamentId, String poolId, String? categoryId) async {
    await _dio.put<void>(
      '/tournaments/$tournamentId/pools/$poolId/category',
      data: {'categoryId': categoryId},
    );
  }

  // ---------------------------------------------------------------------------
  // Admin delegation
  // ---------------------------------------------------------------------------

  @override
  Future<List<TournamentAdminModel>> getAdmins(String tournamentId) async {
    final response =
        await _dio.get<dynamic>('/tournaments/$tournamentId/admins');
    final items = _extractList(response.data);
    return items
        .map((e) =>
            TournamentAdminModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TournamentAdminModel> addAdmin(
      String tournamentId, Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>(
        '/tournaments/$tournamentId/admins',
        data: data);
    return TournamentAdminModel.fromJson(_requireMapData(response, 'add admin'));
  }

  @override
  Future<void> removeAdmin(String tournamentId, String adminUserId) async {
    await _dio
        .delete<void>('/tournaments/$tournamentId/admins/$adminUserId');
  }

  @override
  Future<Map<String, dynamic>> updateTeamPayment(
      String tournamentId, String teamId, String paymentStatus) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/tournaments/$tournamentId/teams/$teamId/payment',
      data: {'paymentStatus': paymentStatus},
    );
    return _requireMapData(response, 'update team payment');
  }

  @override
  Future<Map<String, dynamic>> batchUpdateTeamPayment(
      String tournamentId, List<String> teamIds, String paymentStatus) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/tournaments/$tournamentId/teams/payment/batch',
      data: {
        'teamIds': teamIds,
        'paymentStatus': paymentStatus,
      },
    );
    return _requireMapData(response, 'batch update team payment');
  }

  @override
  Future<void> deleteTeam(String tournamentId, String teamId) async {
    await _dio.delete<void>('/tournaments/$tournamentId/teams/$teamId');
  }

  // ---------------------------------------------------------------------------
  // Score submission
  // ---------------------------------------------------------------------------

  @override
  Future<void> submitScore(
    String tournamentId,
    String matchId, {
    required int homeScore,
    required int awayScore,
  }) async {
    await _dio.post<void>(
      '/tournaments/$tournamentId/matches/$matchId/score',
      data: {'homeScore': homeScore, 'awayScore': awayScore},
    );
  }

  @override
  Future<void> adminUpdateScore(
    String tournamentId,
    String matchId, {
    required int homeScore,
    required int awayScore,
  }) async {
    await _dio.put<void>(
      '/tournaments/$tournamentId/matches/$matchId/score',
      data: {'homeScore': homeScore, 'awayScore': awayScore},
    );
  }

  // ---------------------------------------------------------------------------
  // Team invitations
  // ---------------------------------------------------------------------------

  @override
  Future<void> sendInvitation(
      String tournamentId, String teamId, Map<String, dynamic> data) async {
    await _dio.post<void>(
        '/tournaments/$tournamentId/teams/$teamId/invitations',
        data: data);
  }

  @override
  Future<List<Map<String, dynamic>>> getTeamInvitations(
      String tournamentId, String teamId) async {
    final response = await _dio.get<dynamic>(
        '/tournaments/$tournamentId/teams/$teamId/invitations');
    return (_extractList(response.data))
        .map((e) => e as Map<String, dynamic>)
        .toList();
  }

  @override
  Future<List<Map<String, dynamic>>> getMyInvitations() async {
    final response =
        await _dio.get<dynamic>('/tournaments/invitations/my');
    return (_extractList(response.data))
        .map((e) => e as Map<String, dynamic>)
        .toList();
  }

  @override
  Future<void> acceptInvitation(String inviteToken) async {
    await _dio
        .post<void>('/tournaments/invitations/$inviteToken/accept');
  }

  @override
  Future<void> declineInvitation(String inviteToken) async {
    await _dio
        .post<void>('/tournaments/invitations/$inviteToken/decline');
  }

  @override
  Future<Map<String, dynamic>> getInvitation(String inviteToken) async {
    final response = await _dio.get<Map<String, dynamic>>('/tournaments/invitations/$inviteToken');
    return _requireMapData(response, 'invitation');
  }

  @override
  Future<void> cancelInvitation(
      String tournamentId, String teamId, String invitationId) async {
    await _dio.delete<void>(
        '/tournaments/$tournamentId/teams/$teamId/invitations/$invitationId');
  }

  @override
  Future<Map<String, dynamic>> getInvitationDetails(String inviteToken) async {
    final response = await _dio.get<Map<String, dynamic>>(
        '/tournaments/invitations/preview/$inviteToken');
    return _requireMapData(response, 'get invitation details');
  }

  // ---------------------------------------------------------------------------
  // Players
  // ---------------------------------------------------------------------------

  @override
  Future<List<Map<String, dynamic>>> getPlayers(
      String tournamentId, String teamId) async {
    final response = await _dio.get<dynamic>(
        '/tournaments/$tournamentId/teams/$teamId/players');
    return (_extractList(response.data))
        .map((e) => e as Map<String, dynamic>)
        .toList();
  }

  @override
  Future<void> removePlayer(
      String tournamentId, String teamId, String playerId) async {
    await _dio.delete<void>(
        '/tournaments/$tournamentId/teams/$teamId/players/$playerId');
  }

  @override
  Future<Map<String, dynamic>> generateCheckInQrToken(
      String tournamentId, String teamId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/tournaments/$tournamentId/teams/$teamId/check-in/token',
    );
    return _requireMapData(response, 'generate check-in QR token');
  }

  @override
  Future<Map<String, dynamic>> checkInViaQrToken(
      String tournamentId, String token) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/tournaments/$tournamentId/check-in/qr',
      data: {'token': token},
    );
    return _requireMapData(response, 'check in via QR token');
  }

  // ---------------------------------------------------------------------------
  // Tournament update & status
  // ---------------------------------------------------------------------------

  @override
  Future<TournamentModel> updateTournament(String id, Map<String, dynamic> data) async {
    final response = await _dio.put<Map<String, dynamic>>('/tournaments/$id', data: data);
    return TournamentModel.fromJson(_requireMapData(response, 'update tournament'));
  }

  @override
  Future<void> deleteTournament(String id) async {
    await _dio.delete('/tournaments/$id');
  }

  @override
  Future<void> cancelTournament(String id) async {
    await _dio.post<void>('/tournaments/$id/cancel');
  }

  // ---------------------------------------------------------------------------
  // Match management
  // ---------------------------------------------------------------------------

  @override
  Future<void> createMatch(String tournamentId, Map<String, dynamic> data) async {
    await _dio.post('/tournaments/$tournamentId/matches', data: data);
  }

  @override
  Future<void> updateMatch(String tournamentId, String matchId, Map<String, dynamic> data) async {
    await _dio.put('/tournaments/$tournamentId/matches/$matchId', data: data);
  }

  @override
  Future<void> deleteMatch(String tournamentId, String matchId) async {
    await _dio.delete('/tournaments/$tournamentId/matches/$matchId');
  }

  @override
  Future<void> assignReferee(
      String tournamentId, String matchId, String? refereeTeamId) async {
    await _dio.put<void>(
      '/tournaments/$tournamentId/matches/$matchId/referee',
      data: {'refereeTeamId': refereeTeamId},
    );
  }

  @override
  Future<Map<String, dynamic>> autoAssignReferees(
    String tournamentId, {
    int? roundNumber,
    String? groupName,
    String? stage,
  }) async {
    final body = <String, dynamic>{};
    if (roundNumber != null) body['roundNumber'] = roundNumber;
    if (groupName != null) body['groupName'] = groupName;
    if (stage != null) body['stage'] = stage;
    final response = await _dio.post<dynamic>(
      '/tournaments/$tournamentId/matches/auto-assign-referees',
      data: body,
    );
    return (response.data as Map<String, dynamic>?) ?? {};
  }

  @override
  Future<List<RefereeDutyModel>> getRefereeDuties(String tournamentId) async {
    final response = await _dio.get<dynamic>(
      '/tournaments/$tournamentId/referee-duties',
    );
    return _extractList(response.data)
        .map((e) => RefereeDutyModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> assignScorekeeper(
      String tournamentId, String matchId, String? scorekeeperUserId) async {
    await _dio.put<void>(
      '/tournaments/$tournamentId/matches/$matchId/scorekeeper',
      data: {'scorekeeperUserId': scorekeeperUserId},
    );
  }

  @override
  Future<void> startMatch(String tournamentId, String matchId) async {
    await _dio.put<void>('/tournaments/$tournamentId/matches/$matchId/start');
  }

  @override
  Future<List<Map<String, dynamic>>> getMatchIncidents(
      String tournamentId, String matchId) async {
    final response = await _dio.get<dynamic>(
      '/tournaments/$tournamentId/matches/$matchId/incidents',
    );
    return _extractList(response.data)
        .map((e) => e as Map<String, dynamic>)
        .toList();
  }

  @override
  Future<Map<String, dynamic>> createMatchIncident(
    String tournamentId,
    String matchId, {
    String? incidentType,
    required String description,
    int? slaMinutes,
  }) async {
    final body = <String, dynamic>{'description': description};
    if (incidentType != null && incidentType.trim().isNotEmpty) {
      body['incidentType'] = incidentType.trim();
    }
    if (slaMinutes != null) body['slaMinutes'] = slaMinutes;
    final response = await _dio.post<Map<String, dynamic>>(
      '/tournaments/$tournamentId/matches/$matchId/incidents',
      data: body,
    );
    return _requireMapData(response, 'create match incident');
  }

  @override
  Future<Map<String, dynamic>> resolveMatchIncident(
    String tournamentId,
    String incidentId, {
    required String status,
    String? resolution,
  }) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/tournaments/$tournamentId/incidents/$incidentId/resolve',
      data: {
        'status': status,
        if (resolution != null) 'resolution': resolution,
      },
    );
    return _requireMapData(response, 'resolve match incident');
  }

  @override
  Future<Map<String, dynamic>> generateBrackets(
      String tournamentId,
      {int? numberOfGroups, int? teamsPerGroup, bool usePoolAssignments = false, bool forceGenerate = false}) async {
    final body = <String, dynamic>{};
    if (numberOfGroups != null) body['numberOfGroups'] = numberOfGroups;
    if (teamsPerGroup != null) body['teamsPerGroup'] = teamsPerGroup;
    if (usePoolAssignments) body['usePoolAssignments'] = true;
    if (forceGenerate) body['forceGenerate'] = true;
    final response = await _dio.post<Map<String, dynamic>>(
      '/tournaments/$tournamentId/generate-brackets',
      data: body,
    );
    return _requireMapData(response, 'generate brackets');
  }

  @override
  Future<Map<String, dynamic>> generateGroupMatches(
      String tournamentId,
      {int? numberOfGroups, int? teamsPerGroup, bool usePoolAssignments = false, bool forceGenerate = false}) async {
    final body = <String, dynamic>{};
    if (numberOfGroups != null) body['numberOfGroups'] = numberOfGroups;
    if (teamsPerGroup != null) body['teamsPerGroup'] = teamsPerGroup;
    if (usePoolAssignments) body['usePoolAssignments'] = true;
    if (forceGenerate) body['forceGenerate'] = true;
    final response = await _dio.post<Map<String, dynamic>>(
      '/tournaments/$tournamentId/generate-group-matches',
      data: body,
    );
    return _requireMapData(response, 'generate group matches');
  }

  // ---------------------------------------------------------------------------
  // Announcements
  // ---------------------------------------------------------------------------

  @override
  Future<List<TournamentAnnouncementModel>> getAnnouncements(String tournamentId) async {
    final response = await _dio.get<dynamic>('/tournaments/$tournamentId/announcements');
    return _extractList(response.data)
        .map((e) => TournamentAnnouncementModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TournamentAnnouncementModel> createAnnouncement(
      String tournamentId, {required String title, required String body, bool isPinned = false}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/tournaments/$tournamentId/announcements',
      data: {'title': title, 'body': body, 'isPinned': isPinned},
    );
    return TournamentAnnouncementModel.fromJson(_requireMapData(response, 'create announcement'));
  }

  @override
  Future<TournamentAnnouncementModel> updateAnnouncement(
      String tournamentId, String announcementId, {String? title, String? body, bool? isPinned}) async {
    final data = <String, dynamic>{};
    if (title != null) data['title'] = title;
    if (body != null) data['body'] = body;
    if (isPinned != null) data['isPinned'] = isPinned;
    final response = await _dio.put<Map<String, dynamic>>(
      '/tournaments/$tournamentId/announcements/$announcementId',
      data: data,
    );
    return TournamentAnnouncementModel.fromJson(_requireMapData(response, 'update announcement'));
  }

  @override
  Future<void> deleteAnnouncement(String tournamentId, String announcementId) async {
    await _dio.delete<void>('/tournaments/$tournamentId/announcements/$announcementId');
  }

  // ---------------------------------------------------------------------------
  // Registration fields
  // ---------------------------------------------------------------------------

  @override
  Future<List<TournamentRegistrationFieldModel>> getRegistrationFields(String tournamentId) async {
    final response = await _dio.get<dynamic>('/tournaments/$tournamentId/registration-fields');
    return _extractList(response.data)
        .map((e) => TournamentRegistrationFieldModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TournamentRegistrationFieldModel> createRegistrationField(
      String tournamentId, Map<String, dynamic> data) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/tournaments/$tournamentId/registration-fields',
      data: data,
    );
    return TournamentRegistrationFieldModel.fromJson(
        _requireMapData(response, 'create registration field'));
  }

  @override
  Future<TournamentRegistrationFieldModel> updateRegistrationField(
      String tournamentId, String fieldId, Map<String, dynamic> data) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/tournaments/$tournamentId/registration-fields/$fieldId',
      data: data,
    );
    return TournamentRegistrationFieldModel.fromJson(
        _requireMapData(response, 'update registration field'));
  }

  @override
  Future<void> deleteRegistrationField(String tournamentId, String fieldId) async {
    await _dio.delete<void>('/tournaments/$tournamentId/registration-fields/$fieldId');
  }

  // ---------------------------------------------------------------------------
  // Registration waitlist
  // ---------------------------------------------------------------------------

  @override
  Future<List<TournamentRegistrationWaitlistModel>> getRegistrationWaitlist(String tournamentId) async {
    final response = await _dio.get<dynamic>('/tournaments/$tournamentId/registration-waitlist');
    return _extractList(response.data)
        .map((e) => TournamentRegistrationWaitlistModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> joinRegistrationWaitlist(String tournamentId, String teamName) async {
    await _dio.post<void>(
      '/tournaments/$tournamentId/registration-waitlist',
      data: {'teamName': teamName},
    );
  }

  @override
  Future<void> leaveRegistrationWaitlist(String tournamentId) async {
    await _dio.delete<void>('/tournaments/$tournamentId/registration-waitlist/me');
  }

  @override
  Future<void> promoteFromRegistrationWaitlist(String tournamentId, String entryId) async {
    await _dio.post<void>('/tournaments/$tournamentId/registration-waitlist/$entryId/promote');
  }

  @override
  Future<void> removeFromRegistrationWaitlist(String tournamentId, String entryId) async {
    await _dio.delete<void>('/tournaments/$tournamentId/registration-waitlist/$entryId');
  }

  // ---------------------------------------------------------------------------
  // Courts (Phase 3 — game-day scheduling)
  // ---------------------------------------------------------------------------

  @override
  Future<List<TournamentCourtModel>> getCourts(String tournamentId) async {
    final response = await _dio.get<dynamic>('/tournaments/$tournamentId/courts');
    return _extractList(response.data)
        .map((e) => TournamentCourtModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TournamentCourtModel> createCourt(String tournamentId,
      {required String name, String? location}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/tournaments/$tournamentId/courts',
      data: {'name': name, if (location != null) 'location': location},
    );
    return TournamentCourtModel.fromJson(_requireMapData(response, 'create court'));
  }

  @override
  Future<TournamentCourtModel> updateCourt(
      String tournamentId, String courtId, Map<String, dynamic> data) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/tournaments/$tournamentId/courts/$courtId',
      data: data,
    );
    return TournamentCourtModel.fromJson(_requireMapData(response, 'update court'));
  }

  @override
  Future<void> deleteCourt(String tournamentId, String courtId) async {
    await _dio.delete<void>('/tournaments/$tournamentId/courts/$courtId');
  }

  @override
  Future<void> scheduleMatchOnCourt(
      String tournamentId, String matchId, String courtId,
      {DateTime? scheduledAt, int? durationMinutes}) async {
    final body = <String, dynamic>{'courtId': courtId};
    if (scheduledAt != null) body['scheduledAt'] = scheduledAt.toUtc().toIso8601String();
    if (durationMinutes != null) body['scheduledDurationMinutes'] = durationMinutes;
    await _dio.put<void>(
      '/tournaments/$tournamentId/matches/$matchId/court',
      data: body,
    );
  }

  // ---------------------------------------------------------------------------
  // Score disputes
  // ---------------------------------------------------------------------------

  @override
  Future<List<TournamentScoreDisputeModel>> getMatchDisputes(
      String tournamentId, String matchId) async {
    final response = await _dio.get<dynamic>(
        '/tournaments/$tournamentId/matches/$matchId/disputes');
    return _extractList(response.data)
        .map((e) => TournamentScoreDisputeModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TournamentScoreDisputeModel> createScoreDispute(
      String tournamentId, String matchId, {required String reason}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/tournaments/$tournamentId/matches/$matchId/disputes',
      data: {'reason': reason},
    );
    return TournamentScoreDisputeModel.fromJson(
        _requireMapData(response, 'create score dispute'));
  }

  @override
  Future<void> resolveScoreDispute(
      String tournamentId, String disputeId,
      {required String status, String? resolution}) async {
    await _dio.put<void>(
      '/tournaments/$tournamentId/disputes/$disputeId/resolve',
      data: {'status': status, if (resolution != null) 'resolution': resolution},
    );
  }

  // ---------------------------------------------------------------------------
  // Analytics & portal (Phase 4 + 5)
  // ---------------------------------------------------------------------------

  @override
  Future<TournamentAnalyticsModel> getTournamentAnalytics(String tournamentId) async {
    final response = await _dio.get<Map<String, dynamic>>(
        '/tournaments/$tournamentId/analytics');
    return TournamentAnalyticsModel.fromJson(
        _requireMapData(response, 'get tournament analytics'));
  }

  @override
  Future<String> generateShareToken(String tournamentId) async {
    final response = await _dio.post<Map<String, dynamic>>(
        '/tournaments/$tournamentId/share-token');
    final data = _requireMapData(response, 'generate share token');
    return data['shareToken'] as String;
  }

  @override
  Future<Map<String, dynamic>> getPublicPortal(String shareToken) async {
    final response = await _dio.get<Map<String, dynamic>>(
        '/tournaments/portal/$shareToken');
    return _requireMapData(response, 'get public portal');
  }

  // ---------------------------------------------------------------------------
  // Waiver acceptance
  // ---------------------------------------------------------------------------

  @override
  Future<void> acceptTeamWaiver(String tournamentId, String teamId) async {
    await _dio.post<void>(
        '/tournaments/$tournamentId/teams/$teamId/waiver/accept');
  }

  // ---------------------------------------------------------------------------
  // Manual check-in
  // ---------------------------------------------------------------------------

  @override
  Future<void> checkInTeam(String tournamentId, String teamId) async {
    await _dio.post<void>(
        '/tournaments/$tournamentId/teams/$teamId/check-in');
  }

  // ---------------------------------------------------------------------------
  // Clone
  // ---------------------------------------------------------------------------

  @override
  Future<TournamentModel> cloneTournament(String tournamentId) async {
    final response = await _dio.post<Map<String, dynamic>>(
        '/tournaments/$tournamentId/clone');
    return TournamentModel.fromJson(_requireMapData(response, 'clone tournament'));
  }
}

final tournamentRepositoryProvider = Provider<TournamentRepository>((ref) {
  return TournamentRepositoryImpl(ref.watch(dioProvider));
});

final tournamentReadRepositoryProvider =
    Provider<TournamentReadRepository>((ref) {
  return ref.watch(tournamentRepositoryProvider);
});

final tournamentWriteRepositoryProvider =
    Provider<TournamentWriteRepository>((ref) {
  return ref.watch(tournamentRepositoryProvider);
});

final teamRegistrationRepositoryProvider =
    Provider<TeamRegistrationRepository>((ref) {
  return ref.watch(tournamentRepositoryProvider);
});

final poolRepositoryProvider = Provider<PoolRepository>((ref) {
  return ref.watch(tournamentRepositoryProvider);
});

final categoryRepositoryProvider = Provider<CategoryRepository>((ref) {
  return ref.watch(tournamentRepositoryProvider);
});

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return ref.watch(tournamentRepositoryProvider);
});

final invitationRepositoryProvider = Provider<InvitationRepository>((ref) {
  return ref.watch(tournamentRepositoryProvider);
});

final matchRepositoryProvider = Provider<MatchRepository>((ref) {
  return ref.watch(tournamentRepositoryProvider);
});
