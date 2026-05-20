import 'package:equatable/equatable.dart';

DateTime _requireParsedTournamentDate(String? raw, String fieldName) {
  final parsed = raw != null ? DateTime.tryParse(raw) : null;
  if (parsed == null) {
    throw FormatException('Invalid $fieldName timestamp');
  }
  return parsed;
}

String _requireTournamentIdentifier(List<dynamic> candidates, String fieldName) {
  for (final candidate in candidates) {
    final value = candidate?.toString().trim();
    if (value != null && value.isNotEmpty && value.toLowerCase() != 'null') {
      return value;
    }
  }
  throw FormatException('Missing $fieldName');
}

// ---------------------------------------------------------------------------
// Standing model (from TournamentStanding table)
// ---------------------------------------------------------------------------

class TournamentStandingModel extends Equatable {
  const TournamentStandingModel({
    required this.id,
    required this.teamId,
    required this.teamName,
    required this.points,
    required this.wins,
    required this.losses,
    required this.draws,
    required this.goalsFor,
    required this.goalsAgainst,
    this.groupName,
  });

  final String id;
  final String teamId;
  final String teamName;
  final int points;
  final int wins;
  final int losses;
  final int draws;
  final int goalsFor;
  final int goalsAgainst;
  final String? groupName;

  int get goalDifference => goalsFor - goalsAgainst;
  int get played => wins + losses + draws;

  factory TournamentStandingModel.fromJson(Map<String, dynamic> json) {
    final team = json['team'] as Map<String, dynamic>?;
    return TournamentStandingModel(
      id: json['id'] as String,
      teamId: team?['id'] as String? ?? json['teamId'] as String? ?? '',
      teamName: team?['name'] as String? ?? '',
      points: (json['points'] as num?)?.toInt() ?? 0,
      wins: (json['wins'] as num?)?.toInt() ?? 0,
      losses: (json['losses'] as num?)?.toInt() ?? 0,
      draws: (json['draws'] as num?)?.toInt() ?? 0,
      goalsFor: (json['goalsFor'] as num?)?.toInt() ?? 0,
      goalsAgainst: (json['goalsAgainst'] as num?)?.toInt() ?? 0,
      groupName: json['groupName'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, teamId];
}

// ---------------------------------------------------------------------------
// Pool waitlist entry
// ---------------------------------------------------------------------------

class TournamentWaitlistEntryModel extends Equatable {
  const TournamentWaitlistEntryModel({
    required this.id,
    required this.poolId,
    required this.teamId,
    required this.teamName,
    required this.position,
  });

  final String id;
  final String poolId;
  final String teamId;
  final String teamName;
  final int position;

  factory TournamentWaitlistEntryModel.fromJson(Map<String, dynamic> json) {
    final team = json['team'] as Map<String, dynamic>?;
    return TournamentWaitlistEntryModel(
      id: json['id'] as String,
      poolId: json['poolId'] as String,
      teamId: json['teamId'] as String? ?? team?['id'] as String? ?? '',
      teamName: team?['name'] as String? ?? '',
      position: (json['position'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, poolId, teamId, position];
}

// ---------------------------------------------------------------------------
// Pool model
// ---------------------------------------------------------------------------

class TournamentPoolModel extends Equatable {
  const TournamentPoolModel({
    required this.id,
    required this.tournamentId,
    required this.name,
    required this.maxTeams,
    this.description,
    this.venue,
    this.categoryId,
    this.categoryName,
    this.teams = const [],
    this.waitlist = const [],
  });

  final String id;
  final String tournamentId;
  final String name;
  final int maxTeams;
  final String? description;
  final String? venue;
  final String? categoryId;
  final String? categoryName;
  final List<TournamentTeamModel> teams;
  final List<TournamentWaitlistEntryModel> waitlist;

  bool get isFull => teams.length >= maxTeams;
  int get availableSlots => maxTeams - teams.length;

  factory TournamentPoolModel.fromJson(Map<String, dynamic> json) {
    final teamsList = (json['teams'] as List<dynamic>?)
            ?.map((t) => TournamentTeamModel.fromJson(t as Map<String, dynamic>))
            .toList() ??
        [];
    final waitlistList = (json['waitlist'] as List<dynamic>?)
            ?.map((w) =>
                TournamentWaitlistEntryModel.fromJson(w as Map<String, dynamic>))
            .toList() ??
        [];
    final category = json['category'] as Map<String, dynamic>?;
    return TournamentPoolModel(
      id: json['id'] as String,
      tournamentId: json['tournamentId'] as String? ?? '',
      name: json['name'] as String,
      maxTeams: (json['maxTeams'] as num?)?.toInt() ?? 0,
      description: json['description'] as String?,
      venue: json['venue'] as String?,
      categoryId: json['categoryId'] as String? ?? category?['id'] as String?,
      categoryName: category?['name'] as String?,
      teams: teamsList,
      waitlist: waitlistList,
    );
  }

  @override
  List<Object?> get props => [id, tournamentId, name, maxTeams];
}

// ---------------------------------------------------------------------------
// Category model
// ---------------------------------------------------------------------------

class TournamentCategoryModel extends Equatable {
  const TournamentCategoryModel({
    required this.id,
    required this.tournamentId,
    required this.name,
    this.description,
    this.sortOrder = 0,
    this.pools = const [],
  });

  final String id;
  final String tournamentId;
  final String name;
  final String? description;
  final int sortOrder;
  final List<TournamentPoolModel> pools;

  factory TournamentCategoryModel.fromJson(Map<String, dynamic> json) {
    final poolsList = (json['pools'] as List<dynamic>?)
            ?.map((p) =>
                TournamentPoolModel.fromJson(p as Map<String, dynamic>))
            .toList() ??
        [];
    return TournamentCategoryModel(
      id: json['id'] as String,
      tournamentId: json['tournamentId'] as String? ?? '',
      name: json['name'] as String,
      description: json['description'] as String?,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      pools: poolsList,
    );
  }

  @override
  List<Object?> get props => [id, tournamentId, name, sortOrder];
}

// ---------------------------------------------------------------------------
// Admin role model
// ---------------------------------------------------------------------------

class TournamentAdminModel extends Equatable {
  const TournamentAdminModel({
    required this.id,
    required this.tournamentId,
    required this.userId,
    required this.userName,
    required this.userEmail,
    this.grantedByName,
  });

  final String id;
  final String tournamentId;
  final String userId;
  final String userName;
  final String userEmail;
  final String? grantedByName;

  factory TournamentAdminModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    final grantedBy = json['grantedBy'] as Map<String, dynamic>?;
    return TournamentAdminModel(
      id: json['id'] as String,
      tournamentId: json['tournamentId'] as String? ?? '',
      userId: user?['id'] as String? ?? json['userId'] as String? ?? '',
      userName: user?['name'] as String? ?? '',
      userEmail: user?['email'] as String? ?? '',
      grantedByName: grantedBy?['name'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, tournamentId, userId];
}

// ---------------------------------------------------------------------------
// Team model
// ---------------------------------------------------------------------------

class TournamentTeamModel extends Equatable {
  const TournamentTeamModel({
    required this.id,
    required this.name,
    required this.tournamentId,
    this.poolId,
    this.poolName,
    this.captainUserId,
    this.players = const [],
    this.paymentStatus = 'unpaid',
    this.checkedIn = false,
    this.logoUrl,
  });

  final String id;
  final String name;
  final String tournamentId;
  final String? poolId;
  final String? poolName;
  final String? captainUserId;
  final List<Map<String, dynamic>> players;
  final String paymentStatus; // unpaid | pending | paid | waived
  final bool checkedIn;
  final String? logoUrl;

  bool get isPaid => paymentStatus == 'paid' || paymentStatus == 'waived';

  factory TournamentTeamModel.fromJson(Map<String, dynamic> json) {
    final playersList = (json['players'] as List<dynamic>?)
            ?.map((p) => p as Map<String, dynamic>)
            .toList() ??
        [];
    return TournamentTeamModel(
      id: json['id'] as String,
      name: json['name'] as String,
      tournamentId: json['tournamentId'] as String? ?? '',
      poolId: json['poolId'] as String?,
      poolName: json['poolName'] as String?,
      captainUserId: json['captainUserId'] as String?,
      players: playersList,
      paymentStatus: json['paymentStatus'] as String? ?? 'unpaid',
      checkedIn: json['checkedIn'] as bool? ?? false,
      logoUrl: json['logoUrl'] as String?,
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
    this.stage,
    this.roundNumber,
    this.matchOrder,
    this.groupName,
    this.teamAId,
    this.teamBId,
    this.teamAName,
    this.teamBName,
    this.scoreA,
    this.scoreB,
    this.scheduledAt,
    this.poolId,
    this.location,
  });

  final String id;
  final String tournamentId;
  final String round;
  final String status;
  final String? stage;
  final int? roundNumber;
  final int? matchOrder;
  final String? groupName;
  final String? teamAId;
  final String? teamBId;
  final String? teamAName;
  final String? teamBName;
  final int? scoreA;
  final int? scoreB;
  final DateTime? scheduledAt;
  final String? poolId;
  final String? location;

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
      stage: json['stage'] as String?,
      roundNumber: (json['roundNumber'] as num?)?.toInt(),
      matchOrder: (json['matchOrder'] as num?)?.toInt(),
      groupName: json['groupName'] as String?,
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
      poolId: json['poolId'] as String?,
      location: json['location'] as String?,
    );
  }

  @override
  List<Object?> get props => [
        id,
        tournamentId,
        round,
        status,
        stage,
        roundNumber,
        matchOrder,
        groupName,
      ];
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
    this.organizerName,
    this.organizerEmail,
    this.description,
    this.startDate,
    this.endDate,
    this.maxTeams,
    this.maxPlayers,
    this.registrationStartDate,
    this.registrationDeadline,
    this.location,
    this.locationName,
    this.city,
    this.country,
    this.latitude,
    this.longitude,
    this.prizesDescription,
    this.rulesDescription,
    this.contactEmail,
    this.paymentInfo,
    this.useManualBrackets = false,
    this.autoGenerateBrackets = false,
    this.isPublic = true,
    this.registrationFee,
    this.requirePaymentForBrackets = false,
    this.teams = const [],
    this.matches = const [],
    this.pools = const [],
    this.categories = const [],
    this.admins = const [],
    this.standings = const [],
    this.teamCount = 0,
    this.myTeam,
    this.rosterLockDate,
    this.paymentDeadline,
    this.tiebreakerRules,
  });

  final String id;
  final String name;
  final String sportType;
  final String format; // bracket, pool, round_robin
  final String status; // draft, registration, active, completed
  final DateTime createdAt;
  final String creatorId;
  final String? organizerName;
  final String? organizerEmail;
  final String? description;
  final DateTime? startDate;
  final DateTime? endDate;
  final int? maxTeams;
  final int? maxPlayers;
  final DateTime? registrationStartDate;
  final DateTime? registrationDeadline;
  final String? location;
  final String? locationName;
  final String? city;
  final String? country;
  final double? latitude;
  final double? longitude;
  final String? prizesDescription;
  final String? rulesDescription;
  final String? contactEmail;
  final String? paymentInfo;
  final bool useManualBrackets;
  final bool autoGenerateBrackets;
  final bool isPublic;
  final double? registrationFee;
  final bool requirePaymentForBrackets;
  final List<TournamentTeamModel> teams;
  final List<TournamentMatchModel> matches;
  final List<TournamentPoolModel> pools;
  final List<TournamentCategoryModel> categories;
  final List<TournamentAdminModel> admins;
  final List<TournamentStandingModel> standings;
  final int teamCount;
  final TournamentTeamModel? myTeam;
  final DateTime? rosterLockDate;
  final DateTime? paymentDeadline;
  final List<String>? tiebreakerRules;

  bool get hasFee => registrationFee != null && registrationFee! > 0;
  int get unpaidTeamCount => teams.where((t) => !t.isPaid).length;

  factory TournamentModel.fromJson(Map<String, dynamic> json) {
    final teamsList = (json['teams'] as List<dynamic>?)
            ?.map((t) => TournamentTeamModel.fromJson(t as Map<String, dynamic>))
            .toList() ??
        [];
    final matchesList = (json['matches'] as List<dynamic>?)
            ?.map((m) => TournamentMatchModel.fromJson(m as Map<String, dynamic>))
            .toList() ??
        [];
    final poolsList = (json['pools'] as List<dynamic>?)
            ?.map((p) =>
                TournamentPoolModel.fromJson(p as Map<String, dynamic>))
            .toList() ??
        [];
    final categoriesList = (json['categories'] as List<dynamic>?)
            ?.map((c) =>
                TournamentCategoryModel.fromJson(c as Map<String, dynamic>))
            .toList() ??
        [];
    final adminsList = (json['adminRoles'] as List<dynamic>?)
            ?.map((a) =>
                TournamentAdminModel.fromJson(a as Map<String, dynamic>))
            .toList() ??
        [];
    final standingsList = (json['standings'] as List<dynamic>?)
            ?.map((s) =>
                TournamentStandingModel.fromJson(s as Map<String, dynamic>))
            .toList() ??
        [];
    final count = json['_count'] as Map<String, dynamic>?;
    final organizer = json['organizer'] as Map<String, dynamic>?;
    return TournamentModel(
      id: json['id'] as String,
      name: json['name'] as String,
      sportType: json['sportType'] as String? ?? 'other',
      format: json['format'] as String? ?? 'bracket',
      status: json['status'] as String? ?? 'draft',
      createdAt: _requireParsedTournamentDate(
        json['createdAt'] as String?,
        'tournament createdAt',
      ),
      creatorId: _requireTournamentIdentifier(
        [organizer?['id'], json['organizerId'], json['creatorId']],
        'tournament creatorId',
      ),
      organizerName: organizer?['name'] as String?,
      organizerEmail: organizer?['email'] as String?,
      description: json['description'] as String?,
      startDate: json['startDate'] != null
          ? DateTime.parse(json['startDate'] as String)
          : null,
      maxPlayers: json['maxPlayers'] as int?,
      endDate: json['endDate'] != null
          ? DateTime.tryParse(json['endDate'] as String)
          : null,
      maxTeams: (json['maxTeams'] as num?)?.toInt(),
      registrationStartDate: json['registrationStartDate'] != null
          ? DateTime.tryParse(json['registrationStartDate'] as String)
          : null,
      registrationDeadline: json['registrationDeadline'] != null
          ? DateTime.tryParse(json['registrationDeadline'] as String)
          : null,
      location: json['location'] as String?,
      locationName: json['locationName'] as String?,
      city: json['city'] as String?,
      country: json['country'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      prizesDescription: json['prizesDescription'] as String?,
      rulesDescription: json['rulesDescription'] as String?,
      contactEmail: json['contactEmail'] as String?,
      paymentInfo: json['paymentInfo'] as String?,
      useManualBrackets: json['useManualBrackets'] as bool? ?? false,
      autoGenerateBrackets: json['autoGenerateBrackets'] as bool? ?? false,
      isPublic: json['isPublic'] as bool? ?? true,
      registrationFee: (json['registrationFee'] as num?)?.toDouble(),
      requirePaymentForBrackets:
          json['requirePaymentForBrackets'] as bool? ?? false,
      teams: teamsList,
      matches: matchesList,
      pools: poolsList,
      categories: categoriesList,
      admins: adminsList,
      standings: standingsList,
      teamCount: (count?['teams'] as num?)?.toInt() ?? teamsList.length,
      rosterLockDate: json['rosterLockDate'] != null
          ? DateTime.tryParse(json['rosterLockDate'] as String)
          : null,
      paymentDeadline: json['paymentDeadline'] != null
          ? DateTime.tryParse(json['paymentDeadline'] as String)
          : null,
      tiebreakerRules: (json['tiebreakerRules'] as List<dynamic>?)
          ?.map((r) => r.toString())
          .toList(),
    );
  }

  @override
  List<Object?> get props => [
        id,
        name,
        sportType,
        format,
        status,
        createdAt,
        latitude,
        longitude,
      ];
}

// ---------------------------------------------------------------------------
// Tournament Announcement model (#7)
// ---------------------------------------------------------------------------

class TournamentAnnouncementModel extends Equatable {
  const TournamentAnnouncementModel({
    required this.id,
    required this.tournamentId,
    required this.authorId,
    required this.authorName,
    required this.title,
    required this.body,
    required this.isPinned,
    required this.createdAt,
  });

  final String id;
  final String tournamentId;
  final String authorId;
  final String authorName;
  final String title;
  final String body;
  final bool isPinned;
  final DateTime createdAt;

  factory TournamentAnnouncementModel.fromJson(Map<String, dynamic> json) {
    final author = json['author'] as Map<String, dynamic>?;
    return TournamentAnnouncementModel(
      id: json['id'] as String,
      tournamentId: json['tournamentId'] as String? ?? '',
      authorId: author?['id'] as String? ?? json['authorId'] as String? ?? '',
      authorName: author?['name'] as String? ?? '',
      title: json['title'] as String,
      body: json['body'] as String,
      isPinned: json['isPinned'] as bool? ?? false,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }

  @override
  List<Object?> get props => [id, tournamentId, authorId];
}

// ---------------------------------------------------------------------------
// Score Dispute model (#3)
// ---------------------------------------------------------------------------

class TournamentScoreDisputeModel extends Equatable {
  const TournamentScoreDisputeModel({
    required this.id,
    required this.matchId,
    required this.disputingTeamId,
    required this.disputingTeamName,
    required this.reason,
    required this.status,
    this.resolution,
  });

  final String id;
  final String matchId;
  final String disputingTeamId;
  final String disputingTeamName;
  final String reason;
  final String status; // open | resolved | dismissed
  final String? resolution;

  factory TournamentScoreDisputeModel.fromJson(Map<String, dynamic> json) {
    final team = json['disputingTeam'] as Map<String, dynamic>?;
    return TournamentScoreDisputeModel(
      id: json['id'] as String,
      matchId: json['matchId'] as String? ?? '',
      disputingTeamId: team?['id'] as String? ?? json['disputingTeamId'] as String? ?? '',
      disputingTeamName: team?['name'] as String? ?? '',
      reason: json['reason'] as String? ?? '',
      status: json['status'] as String? ?? 'open',
      resolution: json['resolution'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, matchId, disputingTeamId];
}

// ---------------------------------------------------------------------------
// Registration Field model (#9)
// ---------------------------------------------------------------------------

class TournamentRegistrationFieldModel extends Equatable {
  const TournamentRegistrationFieldModel({
    required this.id,
    required this.tournamentId,
    required this.label,
    required this.fieldType,
    required this.isRequired,
    this.options = const [],
    this.sortOrder = 0,
  });

  final String id;
  final String tournamentId;
  final String label;
  final String fieldType; // text | number | boolean | select
  final bool isRequired;
  final List<String> options;
  final int sortOrder;

  factory TournamentRegistrationFieldModel.fromJson(Map<String, dynamic> json) {
    final opts = (json['options'] as List<dynamic>?)?.map((o) => o.toString()).toList() ?? [];
    return TournamentRegistrationFieldModel(
      id: json['id'] as String,
      tournamentId: json['tournamentId'] as String? ?? '',
      label: json['label'] as String,
      fieldType: json['fieldType'] as String? ?? 'text',
      isRequired: json['isRequired'] as bool? ?? false,
      options: opts,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, tournamentId, label];
}

// ---------------------------------------------------------------------------
// Player stat model (#12)
// ---------------------------------------------------------------------------

class TournamentPlayerStatModel extends Equatable {
  const TournamentPlayerStatModel({
    required this.id,
    required this.playerId,
    required this.playerName,
    this.jerseyNumber,
    required this.statKey,
    required this.value,
  });

  final String id;
  final String playerId;
  final String playerName;
  final int? jerseyNumber;
  final String statKey;
  final double value;

  factory TournamentPlayerStatModel.fromJson(Map<String, dynamic> json) {
    final player = json['player'] as Map<String, dynamic>?;
    return TournamentPlayerStatModel(
      id: json['id'] as String,
      playerId: player?['id'] as String? ?? json['playerId'] as String? ?? '',
      playerName: player?['playerName'] as String? ?? '',
      jerseyNumber: (player?['jerseyNumber'] as num?)?.toInt(),
      statKey: json['statKey'] as String? ?? '',
      value: (json['value'] as num?)?.toDouble() ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, playerId, statKey];
}

// ---------------------------------------------------------------------------
// Registration waitlist entry model (#2)
// ---------------------------------------------------------------------------

class TournamentRegistrationWaitlistModel extends Equatable {
  const TournamentRegistrationWaitlistModel({
    required this.id,
    required this.tournamentId,
    required this.teamId,
    required this.teamName,
    required this.position,
  });

  final String id;
  final String tournamentId;
  final String teamId;
  final String teamName;
  final int position;

  factory TournamentRegistrationWaitlistModel.fromJson(Map<String, dynamic> json) {
    final team = json['team'] as Map<String, dynamic>?;
    return TournamentRegistrationWaitlistModel(
      id: json['id'] as String,
      tournamentId: json['tournamentId'] as String? ?? '',
      teamId: team?['id'] as String? ?? json['teamId'] as String? ?? '',
      teamName: team?['name'] as String? ?? '',
      position: (json['position'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, tournamentId, teamId];
}
