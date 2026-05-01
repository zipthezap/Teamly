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
    var tournaments = items
        .map((e) => TournamentModel.fromJson(e as Map<String, dynamic>))
        .toList();
    if (search != null && search.isNotEmpty) {
      final q = search.toLowerCase();
      tournaments = tournaments.where((t) => t.name.toLowerCase().contains(q)).toList();
    }
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

  // ---------------------------------------------------------------------------
  // Tournament update & status
  // ---------------------------------------------------------------------------

  @override
  Future<TournamentModel> updateTournament(String id, Map<String, dynamic> data) async {
    final response = await _dio.put<Map<String, dynamic>>('/tournaments/$id', data: data);
    return TournamentModel.fromJson(_requireMapData(response, 'update tournament'));
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
  Future<Map<String, dynamic>> generateBrackets(
      String tournamentId, {int? numberOfGroups}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/tournaments/$tournamentId/generate-brackets',
      data: numberOfGroups != null ? {'numberOfGroups': numberOfGroups} : {},
    );
    return _requireMapData(response, 'generate brackets');
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
