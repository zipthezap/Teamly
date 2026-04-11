import 'package:equatable/equatable.dart';

class LeagueMemberRef extends Equatable {
  const LeagueMemberRef({required this.id, required this.name, this.profilePicture});

  final String id;
  final String name;
  final String? profilePicture;

  factory LeagueMemberRef.fromJson(Map<String, dynamic> json) {
    return LeagueMemberRef(
      id: json['id'] as String,
      name: json['name'] as String,
      profilePicture: json['profilePicture'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        if (profilePicture != null) 'profilePicture': profilePicture,
      };

  @override
  List<Object?> get props => [id, name, profilePicture];
}

class LeagueTeamModel extends Equatable {
  const LeagueTeamModel({
    required this.id,
    required this.name,
    required this.leagueId,
    this.captainUserId,
    this.players = const [],
  });

  final String id;
  final String name;
  final String leagueId;
  final String? captainUserId;
  final List<LeaguePlayerModel> players;

  factory LeagueTeamModel.fromJson(Map<String, dynamic> json) {
    return LeagueTeamModel(
      id: json['id'] as String,
      name: json['name'] as String,
      leagueId: json['leagueId'] as String,
      captainUserId: json['captainUserId'] as String?,
      players: (json['players'] as List<dynamic>?)
              ?.map((e) => LeaguePlayerModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  @override
  List<Object?> get props => [id, name, leagueId, captainUserId, players];
}

class LeaguePlayerModel extends Equatable {
  const LeaguePlayerModel({
    required this.id,
    required this.userId,
    required this.teamId,
    this.jerseyNumber,
    this.position,
  });

  final String id;
  final String userId;
  final String teamId;
  final int? jerseyNumber;
  final String? position;

  factory LeaguePlayerModel.fromJson(Map<String, dynamic> json) {
    return LeaguePlayerModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      teamId: json['teamId'] as String,
      jerseyNumber: json['jerseyNumber'] as int?,
      position: json['position'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, userId, teamId, jerseyNumber, position];
}

class LeagueStandingModel extends Equatable {
  const LeagueStandingModel({
    required this.teamId,
    required this.teamName,
    required this.played,
    required this.won,
    required this.drawn,
    required this.lost,
    required this.goalsFor,
    required this.goalsAgainst,
    required this.points,
  });

  final String teamId;
  final String teamName;
  final int played;
  final int won;
  final int drawn;
  final int lost;
  final int goalsFor;
  final int goalsAgainst;
  final int points;

  int get goalDifference => goalsFor - goalsAgainst;

  factory LeagueStandingModel.fromJson(Map<String, dynamic> json) {
    final team = json['team'] as Map<String, dynamic>?;
    return LeagueStandingModel(
      teamId: json['teamId'] as String? ?? team?['id'] as String? ?? '',
      teamName: team?['name'] as String? ?? '',
      played: json['played'] as int? ?? 0,
      won: json['won'] as int? ?? 0,
      drawn: json['drawn'] as int? ?? 0,
      lost: json['lost'] as int? ?? 0,
      goalsFor: json['goalsFor'] as int? ?? 0,
      goalsAgainst: json['goalsAgainst'] as int? ?? 0,
      points: json['points'] as int? ?? 0,
    );
  }

  @override
  List<Object?> get props => [teamId, teamName, played, won, drawn, lost, goalsFor, goalsAgainst, points];
}

/// Describes how the league is scheduled.
enum LeagueScheduleType {
  /// League runs for a fixed number of sessions/rounds.
  sessions,
  /// League runs between two calendar dates.
  duration,
}

class LeagueModel extends Equatable {
  const LeagueModel({
    required this.id,
    required this.name,
    required this.sport,
    required this.isPublic,
    required this.memberCount,
    required this.createdAt,
    required this.scheduleType,
    this.description,
    this.location,
    this.coverImage,
    this.owner,
    this.groupId,
    this.status,
    this.sessionCount,
    this.maxTeams,
    this.startDate,
    this.endDate,
    this.teams = const [],
    this.standings = const [],
    this.linkedSessionCount = 0,
  });

  final String id;
  final String name;
  final String sport;
  final bool isPublic;
  final int memberCount;
  final DateTime createdAt;
  final LeagueScheduleType scheduleType;
  final String? description;
  final String? location;
  final String? coverImage;
  final LeagueMemberRef? owner;
  final String? groupId;
  final String? status;

  /// For [LeagueScheduleType.sessions]: total number of sessions planned.
  final int? sessionCount;

  /// For [LeagueScheduleType.sessions]: sessions already linked.
  final int linkedSessionCount;

  final int? maxTeams;
  final DateTime? startDate;
  final DateTime? endDate;
  final List<LeagueTeamModel> teams;
  final List<LeagueStandingModel> standings;

  /// Progress value in [0, 1].  For sessions leagues: linked/total.
  /// For duration leagues: elapsed days / total days.
  double get progress {
    if (scheduleType == LeagueScheduleType.sessions) {
      final total = sessionCount ?? 0;
      if (total == 0) return 0;
      return (linkedSessionCount / total).clamp(0.0, 1.0);
    } else {
      final start = startDate;
      final end = endDate;
      if (start == null || end == null) return 0;
      final total = end.difference(start).inDays;
      if (total == 0) return 0;
      final elapsed = DateTime.now().difference(start).inDays;
      return (elapsed / total).clamp(0.0, 1.0);
    }
  }

  String get progressLabel {
    if (scheduleType == LeagueScheduleType.sessions) {
      return '$linkedSessionCount / ${sessionCount ?? '?'} sessions';
    } else {
      final end = endDate;
      if (end == null) return 'Duration';
      final remaining = end.difference(DateTime.now()).inDays;
      if (remaining < 0) return 'Ended';
      return '$remaining days left';
    }
  }

  factory LeagueModel.fromJson(Map<String, dynamic> json) {
    final rawSchedule = json['scheduleType'] as String?;
    final scheduleType = rawSchedule == 'duration'
        ? LeagueScheduleType.duration
        : LeagueScheduleType.sessions;

    return LeagueModel(
      id: json['id'] as String,
      name: (json['title'] ?? json['name']) as String,
      sport: json['sport'] as String,
      isPublic: json['isPublic'] as bool? ?? true,
      memberCount: json['memberCount'] as int? ??
          (json['_count']?['teams'] as int? ?? 0),
      createdAt: DateTime.parse(json['createdAt'] as String),
      scheduleType: scheduleType,
      description: json['description'] as String?,
      location: json['location'] as String?,
      coverImage: json['coverImage'] as String?,
      owner: json['creator'] != null
          ? LeagueMemberRef.fromJson(json['creator'] as Map<String, dynamic>)
          : json['owner'] != null
              ? LeagueMemberRef.fromJson(json['owner'] as Map<String, dynamic>)
              : null,
      groupId: json['groupId'] as String?,
      status: json['status'] as String?,
      sessionCount: json['sessionCount'] as int?,
      linkedSessionCount: json['linkedSessionCount'] as int? ??
          (json['sessions'] as List<dynamic>?)?.length ??
          0,
      maxTeams: json['maxTeams'] as int?,
      startDate: json['startDate'] != null
          ? DateTime.tryParse(json['startDate'] as String)
          : null,
      endDate: json['endDate'] != null
          ? DateTime.tryParse(json['endDate'] as String)
          : null,
      teams: (json['teams'] as List<dynamic>?)
              ?.map((e) => LeagueTeamModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      standings: (json['standings'] as List<dynamic>?)
              ?.map(
                  (e) => LeagueStandingModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': name,
        'sport': sport,
        'isPublic': isPublic,
        'memberCount': memberCount,
        'createdAt': createdAt.toIso8601String(),
        'scheduleType':
            scheduleType == LeagueScheduleType.duration ? 'duration' : 'sessions',
        if (description != null) 'description': description,
        if (location != null) 'location': location,
        if (coverImage != null) 'coverImage': coverImage,
        if (owner != null) 'creator': owner!.toJson(),
        if (groupId != null) 'groupId': groupId,
        if (status != null) 'status': status,
        if (sessionCount != null) 'sessionCount': sessionCount,
        if (maxTeams != null) 'maxTeams': maxTeams,
        if (startDate != null) 'startDate': startDate!.toIso8601String(),
        if (endDate != null) 'endDate': endDate!.toIso8601String(),
      };

  @override
  List<Object?> get props => [
        id,
        name,
        sport,
        isPublic,
        memberCount,
        createdAt,
        scheduleType,
        description,
        location,
        coverImage,
        owner,
        groupId,
        status,
        sessionCount,
        linkedSessionCount,
        maxTeams,
        startDate,
        endDate,
        teams,
        standings,
      ];
}

