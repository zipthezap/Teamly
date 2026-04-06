import '../../../core/models/tournament_model.dart';

abstract class TournamentRepository {
  Future<List<TournamentModel>> getTournaments();
  Future<TournamentModel> getTournament(String id);
  Future<TournamentModel> createTournament(Map<String, dynamic> data);
  Future<void> addTeam(String tournamentId, Map<String, dynamic> data);
}
