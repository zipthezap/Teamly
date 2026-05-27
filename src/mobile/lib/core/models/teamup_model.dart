import 'package:equatable/equatable.dart';

DateTime _requireParsedDate(String? raw, String fieldName) {
  final parsed = raw != null ? DateTime.tryParse(raw) : null;
  if (parsed == null) {
    throw FormatException('Invalid $fieldName timestamp');
  }
  return parsed;
}

String _requireIdentifier(List<dynamic> candidates, String fieldName) {
  for (final candidate in candidates) {
    final value = candidate?.toString().trim();
    if (value != null && value.isNotEmpty && value.toLowerCase() != 'null') {
      return value;
    }
  }
  throw FormatException('Missing $fieldName');
}

class TeamUpRequestModel extends Equatable {
  const TeamUpRequestModel({
    required this.id,
    required this.title,
    required this.sportType,
    required this.requestType,
    required this.status,
    required this.createdAt,
    required this.creatorId,
    required this.creatorName,
    this.description,
    this.playersNeeded,
    this.dateTime,
    this.location,
    this.city,
    this.creatorPicture,
    this.skillLevel,
    this.responseCount = 0,
    this.acceptedCount = 0,
    this.commentCount = 0,
    this.responses,
    this.positions,
  });

  final String id;
  final String title;
  final String sportType;
  final String requestType; // looking_for_play, need_players
  final String status; // open, filled, cancelled, expired
  final DateTime createdAt;
  final String creatorId;
  final String creatorName;
  final String? description;
  final int? playersNeeded;
  // dateTime is when the session is (need_players) or available-from (looking_for_play)
  final DateTime? dateTime;
  final String? location;
  final String? city;
  final String? creatorPicture;
  final String? skillLevel;
  final int responseCount;
  final int acceptedCount;
  final int commentCount;
  /// Responses embedded in My Requests view (only populated on /my-requests)
  final List<TeamUpResponseModel>? responses;
  final List<TeamUpRequestPositionModel>? positions;

  /// Convenience getter – kept for UI code that still references availableFrom.
  DateTime? get availableFrom => dateTime;

  factory TeamUpRequestModel.fromJson(Map<String, dynamic> json) {
    final creator = json['creator'] as Map<String, dynamic>?;
    final count = json['_count'] as Map<String, dynamic>?;
    return TeamUpRequestModel(
      id: json['id'] as String,
      title: json['title'] as String,
      sportType: json['sportType'] as String? ?? 'other',
      requestType: json['requestType'] as String? ?? 'need_players',
      status: json['status'] as String? ?? 'open',
      createdAt: _requireParsedDate(
        json['createdAt'] as String?,
        'teamup request createdAt',
      ),
      creatorId: _requireIdentifier(
        [creator?['id'], json['creatorId']],
        'teamup request creatorId',
      ),
      creatorName: creator?['name'] as String? ?? 'Unknown',
      description: json['description'] as String?,
      playersNeeded: (json['playersNeeded'] as num?)?.toInt(),
      // Backend returns 'dateTime' – was 'availableFrom' (bug fix)
      dateTime: json['dateTime'] != null
          ? DateTime.tryParse(json['dateTime'] as String)
          : null,
      location: json['location'] as String?,
      city: json['city'] as String?,
      creatorPicture: creator?['profilePicture'] as String?,
      skillLevel: json['skillLevel'] as String?,
      responseCount: (count?['responses'] as num?)?.toInt() ?? 0,
      acceptedCount: (json['acceptedCount'] as num?)?.toInt() ?? 0,
      commentCount: (count?['comments'] as num?)?.toInt() ?? 0,
      responses: (json['responses'] as List<dynamic>?)
          ?.map((e) =>
              TeamUpResponseModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      positions: (json['positions'] as List<dynamic>?)
          ?.map((e) =>
              TeamUpRequestPositionModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  @override
  List<Object?> get props => [id, title, sportType, requestType, status, createdAt, creatorId];
}

class TeamUpRequestPositionModel extends Equatable {
  const TeamUpRequestPositionModel({
    required this.id,
    required this.name,
    required this.slotsNeeded,
    this.skillLevelRequired,
    this.acceptedCount = 0,
    this.slotsAvailable,
    this.isOpen,
  });

  final String id;
  final String name;
  final int slotsNeeded;
  final String? skillLevelRequired;
  final int acceptedCount;
  final int? slotsAvailable;
  final bool? isOpen;

  int get effectiveSlotsAvailable =>
      slotsAvailable ?? (slotsNeeded - acceptedCount);
  bool get hasAvailability => (isOpen ?? true) && effectiveSlotsAvailable > 0;

  factory TeamUpRequestPositionModel.fromJson(Map<String, dynamic> json) {
    return TeamUpRequestPositionModel(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Player',
      slotsNeeded: (json['slotsNeeded'] as num?)?.toInt() ?? 1,
      skillLevelRequired: json['skillLevelRequired'] as String?,
      acceptedCount: (json['acceptedCount'] as num?)?.toInt() ?? 0,
      slotsAvailable: (json['slotsAvailable'] as num?)?.toInt(),
      isOpen: json['isOpen'] as bool?,
    );
  }

  @override
  List<Object?> get props =>
      [id, name, slotsNeeded, skillLevelRequired, acceptedCount, slotsAvailable, isOpen];
}

class TeamUpResponseModel extends Equatable {
  const TeamUpResponseModel({
    required this.id,
    required this.requestId,
    required this.message,
    required this.status,
    required this.createdAt,
    required this.responderId,
    required this.responderName,
    this.responderPicture,
    this.requestPositionId,
    this.requestPositionName,
    this.applicantSkillLevel,
    this.rsvpStatus,
    this.attendanceStatus,
    this.waitlistRank,
    this.matchScore,
    this.matchReasons,
  });

  final String id;
  final String requestId;
  final String message;
  final String status; // pending, accepted, declined, waitlisted, cancelled
  final String responderName;
  final String? responderPicture;
  final String? requestPositionId;
  final String? requestPositionName;
  final String? applicantSkillLevel;
  final String? rsvpStatus;
  final String? attendanceStatus;
  final int? waitlistRank;
  final double? matchScore;
  final List<String>? matchReasons;

  factory TeamUpResponseModel.fromJson(Map<String, dynamic> json) {
    // Backend returns the responder under 'user' key (was 'responder' – bug fix)
    final user = json['user'] as Map<String, dynamic>?;
    final requestPosition = json['requestPosition'] as Map<String, dynamic>?;
    return TeamUpResponseModel(
      id: json['id'] as String,
      requestId: json['teamUpRequestId'] as String? ?? '',
      message: json['message'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      createdAt: _requireParsedDate(
        json['createdAt'] as String?,
        'teamup response createdAt',
      ),
      responderId: user?['id'] as String? ?? json['userId'] as String? ?? '',
      responderName: user?['name'] as String? ?? 'Unknown',
      responderPicture: user?['profilePicture'] as String?,
      requestPositionId: json['requestPositionId'] as String?,
      requestPositionName: requestPosition?['name'] as String?,
      applicantSkillLevel: json['applicantSkillLevel'] as String?,
      rsvpStatus: json['rsvpStatus'] as String?,
      attendanceStatus: json['attendanceStatus'] as String?,
      waitlistRank: (json['waitlistRank'] as num?)?.toInt(),
      matchScore: (json['matchScore'] as num?)?.toDouble(),
      matchReasons: (json['matchReasons'] as List<dynamic>?)
          ?.map((reason) => reason.toString())
          .toList(),
    );
  }

  @override
  List<Object?> get props => [id, requestId, status, createdAt, responderId];
}

/// A response I submitted to someone else's request, enriched with
/// the request context (for the "My Applications" tab).
class TeamUpApplicationModel extends Equatable {
  const TeamUpApplicationModel({
    required this.id,
    required this.requestId,
    required this.message,
    required this.status,
    required this.createdAt,
    required this.requestTitle,
    required this.requestSportType,
    required this.requestType,
    required this.requestStatus,
    this.requestDateTime,
    this.requestCity,
    this.requestLocation,
    this.requestCreatorName,
    this.requestCreatorPicture,
    this.requestPositionId,
    this.requestPositionName,
    this.applicantSkillLevel,
    this.reapplicationEligible = false,
    this.blocksReapply = false,
    this.rsvpStatus,
    this.waitlistRank,
    this.matchScore,
  });

  final String id;
  final String requestId;
  final String message;
  final String status; // pending, accepted, declined, waitlisted, cancelled
  final String requestSportType;
  final String requestType;
  final String requestStatus;
  final DateTime? requestDateTime;
  final String? requestCity;
  final String? requestLocation;
  final String? requestCreatorName;
  final String? requestCreatorPicture;
  final String? requestPositionId;
  final String? requestPositionName;
  final String? applicantSkillLevel;
  final bool reapplicationEligible;
  final bool blocksReapply;
  final String? rsvpStatus;
  final int? waitlistRank;
  final double? matchScore;

  factory TeamUpApplicationModel.fromJson(Map<String, dynamic> json) {
    final req = json['teamUpRequest'] as Map<String, dynamic>?;
    final creator = req?['creator'] as Map<String, dynamic>?;
    final requestPosition = json['requestPosition'] as Map<String, dynamic>?;
    return TeamUpApplicationModel(
      id: json['id'] as String,
      requestId: json['teamUpRequestId'] as String? ?? req?['id'] as String? ?? '',
      message: json['message'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      createdAt: _requireParsedDate(
        json['createdAt'] as String?,
        'teamup application createdAt',
      ),
      requestTitle: req?['title'] as String? ?? 'Unknown request',
      requestSportType: req?['sportType'] as String? ?? 'other',
      requestType: req?['requestType'] as String? ?? 'need_players',
      requestStatus: req?['status'] as String? ?? 'open',
      requestDateTime: req?['dateTime'] != null
          ? DateTime.tryParse(req!['dateTime'] as String)
          : null,
      requestCity: req?['city'] as String?,
      requestLocation: req?['location'] as String?,
      requestCreatorName: creator?['name'] as String?,
      requestCreatorPicture: creator?['profilePicture'] as String?,
      requestPositionId: json['requestPositionId'] as String?,
      requestPositionName: requestPosition?['name'] as String?,
      applicantSkillLevel: json['applicantSkillLevel'] as String?,
      reapplicationEligible: json['reapplicationEligible'] as bool? ?? false,
      blocksReapply: json['blocksReapply'] as bool? ?? false,
      rsvpStatus: json['rsvpStatus'] as String?,
      waitlistRank: (json['waitlistRank'] as num?)?.toInt(),
      matchScore: (json['matchScore'] as num?)?.toDouble(),
    );
  }

  @override
  List<Object?> get props => [id, requestId, status, createdAt];
}

class TeamUpCommentModel extends Equatable {
  const TeamUpCommentModel({
    required this.id,
    required this.requestId,
    required this.content,
    required this.createdAt,
    required this.authorId,
    required this.authorName,
    this.authorPicture,
  });

  final String id;
  final String requestId;
  final String content;
  final DateTime createdAt;
  final String authorId;
  final String authorName;
  final String? authorPicture;

  factory TeamUpCommentModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return TeamUpCommentModel(
      id: json['id'] as String,
      requestId: json['teamUpRequestId'] as String? ?? '',
      content: json['content'] as String,
      createdAt: _requireParsedDate(
        json['createdAt'] as String?,
        'teamup comment createdAt',
      ),
      authorId: user?['id'] as String? ?? json['userId'] as String? ?? '',
      authorName: user?['name'] as String? ?? 'Unknown',
      authorPicture: user?['profilePicture'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, requestId, createdAt, authorId];
}

// ---------------------------------------------------------------------------
// Paginated browse result
// ---------------------------------------------------------------------------

class TeamUpBrowseResult {
  const TeamUpBrowseResult({
    required this.data,
    required this.hasMore,
    this.nextCursor,
    this.total = 0,
  });

  final List<TeamUpRequestModel> data;
  final bool hasMore;
  final String? nextCursor;
  final int total;

  factory TeamUpBrowseResult.fromJson(dynamic raw) {
    if (raw is List) {
      final items = raw
          .map((e) => TeamUpRequestModel.fromJson(e as Map<String, dynamic>))
          .toList();
      return TeamUpBrowseResult(data: items, hasMore: false, total: items.length);
    }
    final map = raw as Map<String, dynamic>;
    final pagination = map['pagination'] as Map<String, dynamic>?;
    final rawItems =
        map['data'] as List<dynamic>? ?? map['requests'] as List<dynamic>? ?? const [];
    final items = rawItems
        .map((e) => TeamUpRequestModel.fromJson(e as Map<String, dynamic>))
        .toList();
    return TeamUpBrowseResult(
      data: items,
      hasMore: pagination?['hasMore'] as bool? ?? false,
      nextCursor: pagination?['nextCursor'] as String?,
      total: (pagination?['total'] as num?)?.toInt() ?? items.length,
    );
  }
}

// ---------------------------------------------------------------------------
// Attendance history
// ---------------------------------------------------------------------------

class TeamUpAttendanceRecordModel extends Equatable {
  const TeamUpAttendanceRecordModel({
    required this.attendanceStatus,
    required this.createdAt,
    required this.requestId,
    required this.requestTitle,
    required this.requestSportType,
    this.requestDateTime,
    this.requestCity,
  });

  final String attendanceStatus;
  final DateTime createdAt;
  final String requestId;
  final String requestTitle;
  final String requestSportType;
  final DateTime? requestDateTime;
  final String? requestCity;

  factory TeamUpAttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    final req = json['teamUpRequest'] as Map<String, dynamic>? ?? const {};
    return TeamUpAttendanceRecordModel(
      attendanceStatus: json['attendanceStatus'] as String? ?? 'attended',
      createdAt: _requireParsedDate(json['createdAt'] as String?, 'attendance createdAt'),
      requestId: req['id'] as String? ?? '',
      requestTitle: req['title'] as String? ?? '',
      requestSportType: req['sportType'] as String? ?? 'other',
      requestDateTime: req['dateTime'] != null
          ? DateTime.tryParse(req['dateTime'] as String)
          : null,
      requestCity: req['city'] as String?,
    );
  }

  @override
  List<Object?> get props => [requestId, attendanceStatus, createdAt];
}

class TeamUpAttendanceHistoryModel {
  const TeamUpAttendanceHistoryModel({
    required this.reliabilityScore,
    required this.totals,
    required this.history,
  });

  final double reliabilityScore;
  final Map<String, int> totals;
  final List<TeamUpAttendanceRecordModel> history;

  factory TeamUpAttendanceHistoryModel.fromJson(Map<String, dynamic> json) {
    final rawTotals = json['totals'] as Map<String, dynamic>? ?? {};
    final rawHistory = json['history'] as List<dynamic>? ?? const [];
    return TeamUpAttendanceHistoryModel(
      reliabilityScore: (json['reliabilityScore'] as num?)?.toDouble() ?? 0,
      totals: rawTotals.map((k, v) => MapEntry(k, (v as num).toInt())),
      history: rawHistory
          .map((e) =>
              TeamUpAttendanceRecordModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

// ---------------------------------------------------------------------------
// Saved search
// ---------------------------------------------------------------------------

class TeamUpSavedSearchModel extends Equatable {
  const TeamUpSavedSearchModel({
    required this.id,
    required this.name,
    required this.notifyOnMatch,
    required this.createdAt,
    this.sportType,
    this.requestType,
    this.skillLevel,
    this.city,
    this.country,
    this.search,
  });

  final String id;
  final String name;
  final bool notifyOnMatch;
  final DateTime createdAt;
  final String? sportType;
  final String? requestType;
  final String? skillLevel;
  final String? city;
  final String? country;
  final String? search;

  factory TeamUpSavedSearchModel.fromJson(Map<String, dynamic> json) {
    return TeamUpSavedSearchModel(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      notifyOnMatch: json['notifyOnMatch'] as bool? ?? true,
      createdAt: _requireParsedDate(json['createdAt'] as String?, 'saved search createdAt'),
      sportType: json['sportType'] as String?,
      requestType: json['requestType'] as String?,
      skillLevel: json['skillLevel'] as String?,
      city: json['city'] as String?,
      country: json['country'] as String?,
      search: json['search'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, name, createdAt];
}

// ---------------------------------------------------------------------------
// TeamUp analytics
// ---------------------------------------------------------------------------

class TeamUpAnalyticsFunnelModel {
  const TeamUpAnalyticsFunnelModel({
    required this.views,
    required this.applications,
    required this.accepted,
    required this.attended,
    required this.viewToApply,
    required this.applyToAccept,
    required this.acceptToAttend,
  });

  final int views;
  final int applications;
  final int accepted;
  final int attended;
  final double viewToApply;
  final double applyToAccept;
  final double acceptToAttend;

  factory TeamUpAnalyticsFunnelModel.fromJson(Map<String, dynamic> json) {
    final conversion = json['conversion'] as Map<String, dynamic>? ?? {};
    return TeamUpAnalyticsFunnelModel(
      views: (json['views'] as num?)?.toInt() ?? 0,
      applications: (json['applications'] as num?)?.toInt() ?? 0,
      accepted: (json['accepted'] as num?)?.toInt() ?? 0,
      attended: (json['attended'] as num?)?.toInt() ?? 0,
      viewToApply: (conversion['viewToApply'] as num?)?.toDouble() ?? 0,
      applyToAccept: (conversion['applyToAccept'] as num?)?.toDouble() ?? 0,
      acceptToAttend: (conversion['acceptToAttend'] as num?)?.toDouble() ?? 0,
    );
  }
}

class TeamUpAnalyticsModel {
  const TeamUpAnalyticsModel({
    required this.funnel,
    required this.averageFillTimeHours,
  });

  final TeamUpAnalyticsFunnelModel funnel;
  final double averageFillTimeHours;

  factory TeamUpAnalyticsModel.fromJson(Map<String, dynamic> json) {
    final fillTime = json['fillTime'] as Map<String, dynamic>? ?? {};
    return TeamUpAnalyticsModel(
      funnel: TeamUpAnalyticsFunnelModel.fromJson(
          json['funnel'] as Map<String, dynamic>? ?? {}),
      averageFillTimeHours: (fillTime['averageHours'] as num?)?.toDouble() ?? 0,
    );
  }
}

// ---------------------------------------------------------------------------
// Replacement suggestion
// ---------------------------------------------------------------------------

class TeamUpReplacementSuggestionModel extends Equatable {
  const TeamUpReplacementSuggestionModel({
    required this.userId,
    required this.userName,
    required this.matchScore,
    required this.reliabilityScore,
    required this.matchReasons,
    this.userPicture,
  });

  final String userId;
  final String userName;
  final String? userPicture;
  final double matchScore;
  final double reliabilityScore;
  final List<String> matchReasons;

  factory TeamUpReplacementSuggestionModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? {};
    final rawReasons = json['matchReasons'] as List<dynamic>? ?? const [];
    return TeamUpReplacementSuggestionModel(
      userId: user['id'] as String? ?? '',
      userName: user['name'] as String? ?? 'Unknown',
      userPicture: user['profilePicture'] as String?,
      matchScore: (json['matchScore'] as num?)?.toDouble() ?? 0,
      reliabilityScore: (json['reliabilityScore'] as num?)?.toDouble() ?? 0,
      matchReasons: rawReasons.map((r) => r.toString()).toList(),
    );
  }

  @override
  List<Object?> get props => [userId, matchScore, reliabilityScore];
}
