import 'package:equatable/equatable.dart';

class EventCreatorModel extends Equatable {
  const EventCreatorModel({
    required this.id,
    required this.name,
    required this.email,
    this.profilePicture,
  });

  final String id;
  final String name;
  final String email;
  final String? profilePicture;

  factory EventCreatorModel.fromJson(Map<String, dynamic> json) {
    return EventCreatorModel(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      profilePicture: json['profilePicture'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, name, email, profilePicture];
}

class EventGroupRef extends Equatable {
  const EventGroupRef({required this.id, required this.name});

  final String id;
  final String name;

  factory EventGroupRef.fromJson(Map<String, dynamic> json) {
    return EventGroupRef(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }

  @override
  List<Object?> get props => [id, name];
}

class EventParticipantModel extends Equatable {
  const EventParticipantModel({
    required this.id,
    required this.userId,
    required this.status,
    this.name,
    this.profilePicture,
  });

  final String id;
  final String userId;
  final String status;
  final String? name;
  final String? profilePicture;

  factory EventParticipantModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return EventParticipantModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      status: json['status'] as String,
      name: user?['name'] as String?,
      profilePicture: user?['profilePicture'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, userId, status];
}

class EventCountModel extends Equatable {
  const EventCountModel({
    required this.participants,
    this.guestParticipants = 0,
    this.comments = 0,
  });

  final int participants;
  final int guestParticipants;
  final int comments;

  factory EventCountModel.fromJson(Map<String, dynamic> json) {
    return EventCountModel(
      participants: (json['participants'] as num?)?.toInt() ?? 0,
      guestParticipants: (json['guestParticipants'] as num?)?.toInt() ?? 0,
      comments: (json['comments'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [participants, guestParticipants, comments];
}

class EventModel extends Equatable {
  const EventModel({
    required this.id,
    required this.title,
    required this.startTime,
    required this.endTime,
    required this.isPublic,
    required this.creator,
    required this.group,
    this.description,
    this.eventType,
    this.location,
    this.locationName,
    this.city,
    this.country,
    this.maxPlayers,
    this.status,
    this.participants = const [],
    this.count,
    this.userGroupRole,
  });

  final String id;
  final String title;
  final DateTime startTime;
  final DateTime endTime;
  final bool isPublic;
  final EventCreatorModel creator;
  final EventGroupRef group;
  final String? description;
  final String? eventType;
  final String? location;
  final String? locationName;
  final String? city;
  final String? country;
  final int? maxPlayers;
  final String? status;
  final List<EventParticipantModel> participants;
  final EventCountModel? count;
  final String? userGroupRole;

  factory EventModel.fromJson(Map<String, dynamic> json) {
    final participantsList = (json['participants'] as List<dynamic>?)
            ?.map((p) => EventParticipantModel.fromJson(p as Map<String, dynamic>))
            .toList() ??
        [];

    return EventModel(
      id: json['id'] as String,
      title: json['title'] as String,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: DateTime.parse(json['endTime'] as String),
      isPublic: (json['isPublic'] as bool?) ?? false,
      creator: EventCreatorModel.fromJson(json['creator'] as Map<String, dynamic>),
      group: EventGroupRef.fromJson(json['group'] as Map<String, dynamic>),
      description: json['description'] as String?,
      eventType: json['eventType'] as String?,
      location: json['location'] as String?,
      locationName: json['locationName'] as String?,
      city: json['city'] as String?,
      country: json['country'] as String?,
      maxPlayers: (json['maxPlayers'] as num?)?.toInt(),
      status: json['status'] as String?,
      participants: participantsList,
      count: json['_count'] != null
          ? EventCountModel.fromJson(json['_count'] as Map<String, dynamic>)
          : null,
      userGroupRole: json['userGroupRole'] as String?,
    );
  }

  int get participantCount =>
      count?.participants ?? participants.where((p) => p.status == 'confirmed').length;

  bool isParticipant(String userId) =>
      participants.any((p) => p.userId == userId && p.status != 'cancelled');

  bool get isFull => maxPlayers != null && participantCount >= maxPlayers!;

  @override
  List<Object?> get props =>
      [id, title, startTime, endTime, isPublic, creator, group, eventType, status, maxPlayers];
}

class ActivityEntryModel extends Equatable {
  const ActivityEntryModel({
    required this.id,
    required this.type,
    required this.createdAt,
    this.userId,
    this.userName,
    this.userPicture,
    this.metadata,
  });

  final String id;
  final String type;
  final DateTime createdAt;
  final String? userId;
  final String? userName;
  final String? userPicture;
  final Map<String, dynamic>? metadata;

  factory ActivityEntryModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return ActivityEntryModel(
      id: json['id'] as String,
      type: json['type'] as String? ?? json['action'] as String? ?? 'unknown',
      createdAt: DateTime.parse(json['createdAt'] as String),
      userId: user?['id'] as String? ?? json['userId'] as String?,
      userName: user?['name'] as String?,
      userPicture: user?['profilePicture'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  String get summary {
    final name = userName ?? 'Someone';
    switch (type) {
      case 'join':
      case 'joined':
        return '$name joined';
      case 'leave':
      case 'left':
        return '$name left';
      case 'late':
      case 'marked_late':
        return '$name marked as late';
      case 'unmark_late':
        return '$name is no longer late';
      case 'status_update':
        return '$name updated their status';
      default:
        return '$name: ${type.replaceAll('_', ' ')}';
    }
  }

  @override
  List<Object?> get props => [id, type, createdAt, userId];
}
