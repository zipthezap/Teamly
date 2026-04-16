import 'package:equatable/equatable.dart';

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
  DateTime? get scheduledAt => dateTime;

  factory TeamUpRequestModel.fromJson(Map<String, dynamic> json) {
    final creator = json['creator'] as Map<String, dynamic>?;
    final count = json['_count'] as Map<String, dynamic>?;
    return TeamUpRequestModel(
      id: json['id'] as String,
      title: json['title'] as String,
      sportType: json['sportType'] as String? ?? 'other',
      requestType: json['requestType'] as String? ?? 'need_players',
      status: json['status'] as String? ?? 'open',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      creatorId: creator?['id'] as String? ??
          json['creatorId'] as String? ??
          'unknown',
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
  });

  final String id;
  final String requestId;
  final String message;
  final String status; // pending, accepted, declined
  final DateTime createdAt;
  final String responderId;
  final String responderName;
  final String? responderPicture;
  final String? requestPositionId;
  final String? requestPositionName;
  final String? applicantSkillLevel;

  factory TeamUpResponseModel.fromJson(Map<String, dynamic> json) {
    // Backend returns the responder under 'user' key (was 'responder' – bug fix)
    final user = json['user'] as Map<String, dynamic>?;
    final requestPosition = json['requestPosition'] as Map<String, dynamic>?;
    return TeamUpResponseModel(
      id: json['id'] as String,
      requestId: json['teamUpRequestId'] as String? ?? '',
      message: json['message'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      responderId: user?['id'] as String? ?? json['userId'] as String? ?? '',
      responderName: user?['name'] as String? ?? 'Unknown',
      responderPicture: user?['profilePicture'] as String?,
      requestPositionId: json['requestPositionId'] as String?,
      requestPositionName: requestPosition?['name'] as String?,
      applicantSkillLevel: json['applicantSkillLevel'] as String?,
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
  });

  final String id;
  final String requestId;
  final String message;
  final String status; // pending, accepted, declined
  final DateTime createdAt;
  final String requestTitle;
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

  factory TeamUpApplicationModel.fromJson(Map<String, dynamic> json) {
    final req = json['teamUpRequest'] as Map<String, dynamic>?;
    final creator = req?['creator'] as Map<String, dynamic>?;
    final requestPosition = json['requestPosition'] as Map<String, dynamic>?;
    return TeamUpApplicationModel(
      id: json['id'] as String,
      requestId: json['teamUpRequestId'] as String? ?? req?['id'] as String? ?? '',
      message: json['message'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
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
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      authorId: user?['id'] as String? ?? json['userId'] as String? ?? '',
      authorName: user?['name'] as String? ?? 'Unknown',
      authorPicture: user?['profilePicture'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, requestId, createdAt, authorId];
}
