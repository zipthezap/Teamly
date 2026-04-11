import '../../../core/models/league_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/league_repository.dart';

class LeagueRepositoryImpl implements LeagueRepository {
  LeagueRepositoryImpl(this._apiClient);

  final ApiClient _apiClient;

  @override
  Future<List<LeagueModel>> getLeagues({int page = 1, int limit = 20}) async {
    final response = await _apiClient.get(
      '/leagues',
      queryParameters: {'page': page, 'limit': limit},
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['leagues'] as List<dynamic>? ?? data['data'] as List<dynamic>? ?? [];
    return items
        .map((e) => LeagueModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<LeagueModel> getLeagueById(String leagueId) async {
    final response = await _apiClient.get('/leagues/$leagueId');
    return LeagueModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<LeagueModel> createLeague({
    required String name,
    required String sport,
    required bool isPublic,
    String? description,
    String? location,
  }) async {
    final response = await _apiClient.post('/leagues', data: {
      'name': name,
      'sport': sport,
      'isPublic': isPublic,
      if (description != null) 'description': description,
      if (location != null) 'location': location,
    });
    return LeagueModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<LeagueModel> updateLeague(String leagueId, Map<String, dynamic> updates) async {
    final response = await _apiClient.patch('/leagues/$leagueId', data: updates);
    return LeagueModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<void> deleteLeague(String leagueId) async {
    await _apiClient.delete('/leagues/$leagueId');
  }

  @override
  Future<void> joinLeague(String leagueId) async {
    await _apiClient.post('/leagues/$leagueId/join');
  }

  @override
  Future<void> leaveLeague(String leagueId) async {
    await _apiClient.post('/leagues/$leagueId/leave');
  }
}
