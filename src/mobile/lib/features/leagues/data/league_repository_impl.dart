import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/league_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/league_repository.dart';

final leagueRepositoryProvider = Provider<LeagueRepository>((ref) {
  return LeagueRepositoryImpl(ref.watch(dioProvider));
});

class LeagueRepositoryImpl implements LeagueRepository {
  LeagueRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<LeagueModel>> getLeagues({
    int page = 1,
    int limit = 20,
    String? groupId,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/leagues',
      queryParameters: {
        'page': page,
        'limit': limit,
        if (groupId != null) 'groupId': groupId,
      },
    );
    final data = response.data!;
    final items = data['leagues'] as List<dynamic>? ??
        data['data'] as List<dynamic>? ??
        [];
    return items
        .map((e) => LeagueModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<LeagueModel> getLeagueById(String leagueId) async {
    final response =
        await _dio.get<Map<String, dynamic>>('/leagues/$leagueId');
    return LeagueModel.fromJson(response.data!);
  }

  @override
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
  }) async {
    final response = await _dio.post<Map<String, dynamic>>('/leagues', data: {
      'title': title,
      'sport': sport,
      'isPublic': isPublic,
      'groupId': groupId,
      'startDate': startDate.toIso8601String(),
      'scheduleType':
          scheduleType == LeagueScheduleType.duration ? 'duration' : 'sessions',
      if (description != null) 'description': description,
      if (location != null) 'location': location,
      if (sessionCount != null) 'sessionCount': sessionCount,
      if (maxTeams != null) 'maxTeams': maxTeams,
      if (endDate != null) 'endDate': endDate.toIso8601String(),
    });
    return LeagueModel.fromJson(response.data!);
  }

  @override
  Future<LeagueModel> updateLeague(
      String leagueId, Map<String, dynamic> updates) async {
    final response = await _dio.patch<Map<String, dynamic>>(
        '/leagues/$leagueId',
        data: updates);
    return LeagueModel.fromJson(response.data!);
  }

  @override
  Future<void> deleteLeague(String leagueId) async {
    await _dio.delete<void>('/leagues/$leagueId');
  }

  @override
  Future<void> joinLeague(String leagueId) async {
    await _dio.post<void>('/leagues/$leagueId/join');
  }

  @override
  Future<void> leaveLeague(String leagueId) async {
    await _dio.post<void>('/leagues/$leagueId/leave');
  }

  // ── Teams ──────────────────────────────────────────────────────────────────

  @override
  Future<List<LeagueTeamModel>> getTeams(String leagueId) async {
    final response = await _dio
        .get<dynamic>('/leagues/$leagueId/teams');
    final list = response.data as List<dynamic>? ?? [];
    return list
        .map((e) => LeagueTeamModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<LeagueTeamModel> addTeam(String leagueId, String name,
      {String? captainUserId}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/leagues/$leagueId/teams',
      data: {
        'name': name,
        if (captainUserId != null) 'captainUserId': captainUserId,
      },
    );
    return LeagueTeamModel.fromJson(response.data!);
  }

  @override
  Future<void> removeTeam(String leagueId, String teamId) async {
    await _dio.delete<void>('/leagues/$leagueId/teams/$teamId');
  }

  // ── Standings ──────────────────────────────────────────────────────────────

  @override
  Future<List<LeagueStandingModel>> getStandings(String leagueId) async {
    final response = await _dio
        .get<dynamic>('/leagues/$leagueId/standings');
    final list = response.data as List<dynamic>? ?? [];
    return list
        .map((e) => LeagueStandingModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  @override
  Future<void> linkSession(String leagueId, String sessionId,
      {int? roundNumber}) async {
    await _dio.post<void>('/leagues/$leagueId/sessions', data: {
      'sessionId': sessionId,
      if (roundNumber != null) 'roundNumber': roundNumber,
    });
  }

  // ── Matches ────────────────────────────────────────────────────────────────

  @override
  Future<void> recordMatchResult(
    String leagueId,
    String matchId, {
    required int homeScore,
    required int awayScore,
  }) async {
    await _dio.patch<void>(
      '/leagues/$leagueId/matches/$matchId',
      data: {
        'homeScore': homeScore,
        'awayScore': awayScore,
        'status': 'completed',
      },
    );
  }
}
