import 'package:equatable/equatable.dart';

class SessionCreatorModel extends Equatable {
  const SessionCreatorModel({
    required this.id,
    required this.name,
    required this.email,
    this.profilePicture,
  });

  final String id;
  final String name;
  final String email;
  final String? profilePicture;

  factory SessionCreatorModel.fromJson(Map<String, dynamic> json) {
    return SessionCreatorModel(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      profilePicture: json['profilePicture'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, name, email, profilePicture];
}

class SessionGroupRef extends Equatable {
  const SessionGroupRef({required this.id, required this.name});

  final String id;
  final String name;

  factory SessionGroupRef.fromJson(Map<String, dynamic> json) {
    return SessionGroupRef(
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

class GuestParticipantModel extends Equatable {
  const GuestParticipantModel({
    required this.id,
    required this.name,
    required this.status,
  });

  final String id;
  final String name;
  final String status;

  factory GuestParticipantModel.fromJson(Map<String, dynamic> json) {
    return GuestParticipantModel(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Guest',
      status: json['status'] as String? ?? 'confirmed',
    );
  }

  @override
  List<Object?> get props => [id, name, status];
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

class SessionModel extends Equatable {
  const SessionModel({
    required this.id,
    required this.title,
    required this.startTime,
    required this.endTime,
    required this.isPublic,
    required this.creator,
    required this.group,
    this.description,
    this.sessionType,
    this.location,
    this.locationName,
    this.city,
    this.country,
    this.maxPlayers,
    this.status,
    this.archived,
    this.participants = const [],
    this.guestParticipants = const [],
    this.count,
    this.userGroupRole,
  });

  final String id;
  final String title;
  final DateTime startTime;
  final DateTime endTime;
  final bool isPublic;
  final SessionCreatorModel creator;
  final SessionGroupRef group;
  final String? description;
  final String? eventType;
  final String? location;
  final String? locationName;
  final String? city;
  final String? country;
  final int? maxPlayers;
  final String? status;
  final bool? archived;
  final List<EventParticipantModel> participants;
  final List<GuestParticipantModel> guestParticipants;
  final EventCountModel? count;
  final String? userGroupRole;

  factory SessionModel.fromJson(Map<String, dynamic> json) {
    final participantsList = (json['participants'] as List<dynamic>?)
            ?.map((p) => EventParticipantModel.fromJson(p as Map<String, dynamic>))
            .toList() ??
        [];

    final guestParticipantsList = (json['guestParticipants'] as List<dynamic>?)
            ?.map((g) => GuestParticipantModel.fromJson(g as Map<String, dynamic>))
            .toList() ??
        [];

    return SessionModel(
      id: json['id'] as String,
      title: json['title'] as String,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: DateTime.parse(json['endTime'] as String),
      isPublic: (json['isPublic'] as bool?) ?? false,
      creator: SessionCreatorModel.fromJson(json['creator'] as Map<String, dynamic>),
      group: SessionGroupRef.fromJson(json['group'] as Map<String, dynamic>),
      description: json['description'] as String?,
      sessionType: json['sessionType'] as String?,
      location: json['location'] as String?,
      locationName: json['locationName'] as String?,
      city: json['city'] as String?,
      country: json['country'] as String?,
      maxPlayers: (json['maxPlayers'] as num?)?.toInt(),
      status: json['status'] as String?,
      archived: json['archived'] as bool?,
      participants: participantsList,
      guestParticipants: guestParticipantsList,
      count: json['_count'] != null
          ? EventCountModel.fromJson(json['_count'] as Map<String, dynamic>)
          : null,
      userGroupRole: json['userGroupRole'] as String?,
    );
  }

  int get participantCount {
    if (count != null) {
      return count!.participants + count!.guestParticipants;
    }
    final confirmedParticipants =
        participants.where((p) => p.status == 'confirmed').length;
    final confirmedGuests =
        guestParticipants.where((g) => g.status == 'confirmed').length;
    return confirmedParticipants + confirmedGuests;
  }

  bool isParticipant(String userId) =>
      participants.any((p) => p.userId == userId && p.status != 'cancelled');

  bool get isFull => maxPlayers != null && participantCount >= maxPlayers!;

  @override
  List<Object?> get props =>
      [id, title, startTime, endTime, isPublic, creator, group, eventType, status, archived, maxPlayers];
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
