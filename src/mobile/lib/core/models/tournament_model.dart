import 'package:equatable/equatable.dart';

class TournamentTeamModel extends Equatable {
  const TournamentTeamModel({
    required this.id,
    required this.name,
    required this.tournamentId,
    this.wins = 0,
    this.losses = 0,
    this.points = 0,
    this.poolId,
  });

  final String id;
  final String name;
  final String tournamentId;
  final int wins;
  final int losses;
  final int points;
  final String? poolId;

  factory TournamentTeamModel.fromJson(Map<String, dynamic> json) {
    return TournamentTeamModel(
      id: json['id'] as String,
      name: json['name'] as String,
      tournamentId: json['tournamentId'] as String? ?? '',
      wins: (json['wins'] as num?)?.toInt() ?? 0,
      losses: (json['losses'] as num?)?.toInt() ?? 0,
      points: (json['points'] as num?)?.toInt() ?? 0,
      poolId: json['poolId'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, name, tournamentId];
}

class TournamentMatchModel extends Equatable {
  const TournamentMatchModel({
    required this.id,
    required this.tournamentId,
    required this.round,
    required this.status,
    this.teamAId,
    this.teamBId,
    this.teamAName,
    this.teamBName,
    this.scoreA,
    this.scoreB,
    this.scheduledAt,
  });

  final String id;
  final String tournamentId;
  final String round;
  final String status;
  final String? teamAId;
  final String? teamBId;
  final String? teamAName;
  final String? teamBName;
  final int? scoreA;
  final int? scoreB;
  final DateTime? scheduledAt;

  factory TournamentMatchModel.fromJson(Map<String, dynamic> json) {
    // Support both frontend naming (teamA/teamB) and backend naming (homeTeam/awayTeam)
    final teamA = (json['homeTeam'] ?? json['teamA']) as Map<String, dynamic>?;
    final teamB = (json['awayTeam'] ?? json['teamB']) as Map<String, dynamic>?;

    // Build a human-readable round label from available fields
    String roundLabel;
    if (json['groupName'] != null) {
      roundLabel = json['groupName'] as String;
    } else if (json['roundNumber'] != null) {
      roundLabel = 'Round ${json['roundNumber']}';
    } else if (json['stage'] != null) {
      final stage = (json['stage'] as String).replaceAll('_', ' ');
      roundLabel = stage.isNotEmpty
          ? stage[0].toUpperCase() + stage.substring(1)
          : 'Round 1';
    } else {
      roundLabel = json['round'] as String? ?? 'Round 1';
    }

    return TournamentMatchModel(
      id: json['id'] as String,
      tournamentId: json['tournamentId'] as String? ?? '',
      round: roundLabel,
      status: json['status'] as String? ?? 'scheduled',
      teamAId: teamA?['id'] as String? ??
          json['homeTeamId'] as String? ??
          json['teamAId'] as String?,
      teamBId: teamB?['id'] as String? ??
          json['awayTeamId'] as String? ??
          json['teamBId'] as String?,
      teamAName: teamA?['name'] as String?,
      teamBName: teamB?['name'] as String?,
      scoreA: (json['homeScore'] as num?)?.toInt() ??
          (json['scoreA'] as num?)?.toInt(),
      scoreB: (json['awayScore'] as num?)?.toInt() ??
          (json['scoreB'] as num?)?.toInt(),
      scheduledAt: json['scheduledAt'] != null
          ? DateTime.tryParse(json['scheduledAt'] as String)
          : null,
    );
  }

  @override
  List<Object?> get props => [id, tournamentId, round, status];
}

class TournamentModel extends Equatable {
  const TournamentModel({
    required this.id,
    required this.name,
    required this.sportType,
    required this.format,
    required this.status,
    required this.createdAt,
    required this.creatorId,
    this.description,
    this.startDate,
    this.endDate,
    this.maxTeams,
    this.teams = const [],
    this.matches = const [],
    this.teamCount = 0,
  });

  final String id;
  final String name;
  final String sportType;
  final String format; // bracket, pool, round_robin
  final String status; // draft, registration, active, completed
  final DateTime createdAt;
  final String creatorId;
  final String? description;
  final DateTime? startDate;
  final DateTime? endDate;
  final int? maxTeams;
  final List<TournamentTeamModel> teams;
  final List<TournamentMatchModel> matches;
  final int teamCount;

  factory TournamentModel.fromJson(Map<String, dynamic> json) {
    final teamsList = (json['teams'] as List<dynamic>?)
            ?.map((t) => TournamentTeamModel.fromJson(t as Map<String, dynamic>))
            .toList() ??
        [];
    final matchesList = (json['matches'] as List<dynamic>?)
            ?.map((m) => TournamentMatchModel.fromJson(m as Map<String, dynamic>))
            .toList() ??
        [];
    final count = json['_count'] as Map<String, dynamic>?;
    return TournamentModel(
      id: json['id'] as String,
      name: json['name'] as String,
      sportType: json['sportType'] as String? ?? 'other',
      format: json['format'] as String? ?? 'bracket',
      status: json['status'] as String? ?? 'draft',
      createdAt: DateTime.parse(json['createdAt'] as String),
      creatorId: json['creatorId'] as String? ?? '',
      description: json['description'] as String?,
      startDate: json['startDate'] != null
          ? DateTime.tryParse(json['startDate'] as String)
          : null,
      endDate: json['endDate'] != null
          ? DateTime.tryParse(json['endDate'] as String)
          : null,
      maxTeams: (json['maxTeams'] as num?)?.toInt(),
      teams: teamsList,
      matches: matchesList,
      teamCount: (count?['teams'] as num?)?.toInt() ?? teamsList.length,
    );
  }

  @override
  List<Object?> get props => [id, name, sportType, format, status, createdAt];
}
