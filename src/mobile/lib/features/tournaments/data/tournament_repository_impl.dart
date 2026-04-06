import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/tournament_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/tournament_repository.dart';

class TournamentRepositoryImpl implements TournamentRepository {
  TournamentRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<TournamentModel>> getTournaments() async {
    final response = await _dio.get<dynamic>('/tournaments');
    final data = response.data;
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map<String, dynamic>) {
      items = data['tournaments'] as List<dynamic>? ??
          data['data'] as List<dynamic>? ??
          [];
    } else {
      items = [];
    }
    return items
        .map((e) => TournamentModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TournamentModel> getTournament(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/tournaments/$id');
    return TournamentModel.fromJson(response.data!);
  }

  @override
  Future<TournamentModel> createTournament(Map<String, dynamic> data) async {
    final response =
        await _dio.post<Map<String, dynamic>>('/tournaments', data: data);
    return TournamentModel.fromJson(response.data!);
  }

  @override
  Future<void> addTeam(String tournamentId, Map<String, dynamic> data) async {
    await _dio.post<void>('/tournaments/$tournamentId/teams', data: data);
  }
}

final tournamentRepositoryProvider = Provider<TournamentRepository>((ref) {
  return TournamentRepositoryImpl(ref.watch(dioProvider));
});
