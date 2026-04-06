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
    this.availableFrom,
    this.location,
    this.city,
    this.creatorPicture,
    this.responseCount = 0,
    this.isOwnRequest = false,
  });

  final String id;
  final String title;
  final String sportType;
  final String requestType; // looking_for_play, need_players
  final String status; // open, closed
  final DateTime createdAt;
  final String creatorId;
  final String creatorName;
  final String? description;
  final int? playersNeeded;
  final DateTime? availableFrom;
  final String? location;
  final String? city;
  final String? creatorPicture;
  final int responseCount;
  final bool isOwnRequest;

  factory TeamUpRequestModel.fromJson(Map<String, dynamic> json) {
    final creator = json['user'] as Map<String, dynamic>?;
    final count = json['_count'] as Map<String, dynamic>?;
    return TeamUpRequestModel(
      id: json['id'] as String,
      title: json['title'] as String,
      sportType: json['sportType'] as String? ?? 'other',
      requestType: json['requestType'] as String? ?? 'looking_for_play',
      status: json['status'] as String? ?? 'open',
      createdAt: DateTime.parse(json['createdAt'] as String),
      creatorId: creator?['id'] as String? ?? json['userId'] as String? ?? '',
      creatorName: creator?['name'] as String? ?? 'Unknown',
      description: json['description'] as String?,
      playersNeeded: (json['playersNeeded'] as num?)?.toInt(),
      availableFrom: json['availableFrom'] != null
          ? DateTime.tryParse(json['availableFrom'] as String)
          : null,
      location: json['location'] as String?,
      city: json['city'] as String?,
      creatorPicture: creator?['profilePicture'] as String?,
      responseCount: (count?['responses'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, title, sportType, requestType, status, createdAt, creatorId];
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
  });

  final String id;
  final String requestId;
  final String message;
  final String status; // pending, accepted, rejected
  final DateTime createdAt;
  final String responderId;
  final String responderName;
  final String? responderPicture;

  factory TeamUpResponseModel.fromJson(Map<String, dynamic> json) {
    final responder = json['responder'] as Map<String, dynamic>?;
    return TeamUpResponseModel(
      id: json['id'] as String,
      requestId: json['teamUpRequestId'] as String? ?? '',
      message: json['message'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      createdAt: DateTime.parse(json['createdAt'] as String),
      responderId: responder?['id'] as String? ?? json['responderId'] as String? ?? '',
      responderName: responder?['name'] as String? ?? 'Unknown',
      responderPicture: responder?['profilePicture'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, requestId, status, createdAt, responderId];
}
