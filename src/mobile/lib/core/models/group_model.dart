import 'package:equatable/equatable.dart';

class GroupMemberModel extends Equatable {
  const GroupMemberModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.profilePicture,
  });

  final String id;
  final String name;
  final String email;
  final String role;
  final String? profilePicture;

  factory GroupMemberModel.fromJson(Map<String, dynamic> json) {
    return GroupMemberModel(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      role: json['role'] as String,
      profilePicture: json['profilePicture'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, name, email, role, profilePicture];
}

class GroupCountModel extends Equatable {
  const GroupCountModel({required this.events, required this.members});

  final int events;
  final int members;

  factory GroupCountModel.fromJson(Map<String, dynamic> json) {
    return GroupCountModel(
      events: (json['events'] as num?)?.toInt() ?? 0,
      members: (json['members'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [events, members];
}

class JoinRequestModel extends Equatable {
  const JoinRequestModel({
    required this.id,
    required this.userId,
    required this.userName,
    required this.status,
    required this.createdAt,
    this.userPicture,
    this.userEmail,
  });

  final String id;
  final String userId;
  final String userName;
  final String status; // pending, approved, rejected
  final DateTime createdAt;
  final String? userPicture;
  final String? userEmail;

  factory JoinRequestModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return JoinRequestModel(
      id: json['id'] as String,
      userId: (json['userId'] ?? user?['id']) as String,
      userName: user?['name'] as String? ?? 'Unknown',
      status: json['status'] as String? ?? 'pending',
      createdAt: DateTime.parse(json['createdAt'] as String),
      userPicture: user?['profilePicture'] as String?,
      userEmail: user?['email'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, userId, status, createdAt];
}

class GroupModel extends Equatable {
  const GroupModel({
    required this.id,
    required this.name,
    required this.isPublic,
    required this.createdAt,
    this.description,
    this.sportType,
    this.profilePicture,
    this.city,
    this.country,
    this.locationName,
    this.maxMembers,
    this.tags,
    this.autoApproveJoinRequests = false,
    this.allowMemberInvites = true,
    this.members = const [],
    this.count,
    this.creatorId,
    this.distance,
  });

  final String id;
  final String name;
  final bool isPublic;
  final DateTime createdAt;
  final String? description;
  final String? sportType;
  final String? profilePicture;
  final String? city;
  final String? country;
  final String? locationName;
  final int? maxMembers;
  final String? tags;
  final bool autoApproveJoinRequests;
  final bool allowMemberInvites;
  final List<GroupMemberModel> members;
  final GroupCountModel? count;
  final String? creatorId;
  final double? distance;

  factory GroupModel.fromJson(Map<String, dynamic> json) {
    final membersList = (json['members'] as List<dynamic>?)
            ?.map((m) => GroupMemberModel.fromJson(m as Map<String, dynamic>))
            .toList() ??
        [];

    return GroupModel(
      id: json['id'] as String,
      name: json['name'] as String,
      isPublic: (json['isPublic'] as bool?) ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      description: json['description'] as String?,
      sportType: json['sportType'] as String?,
      profilePicture: json['profilePicture'] as String?,
      city: json['city'] as String?,
      country: json['country'] as String?,
      locationName: json['locationName'] as String?,
      maxMembers: (json['maxMembers'] as num?)?.toInt(),
      tags: json['tags'] as String?,
      autoApproveJoinRequests: (json['autoApproveJoinRequests'] as bool?) ?? false,
      allowMemberInvites: (json['allowMemberInvites'] as bool?) ?? true,
      members: membersList,
      count: json['_count'] != null
          ? GroupCountModel.fromJson(json['_count'] as Map<String, dynamic>)
          : null,
      creatorId: json['creatorId'] as String?,
      distance: (json['distance'] as num?)?.toDouble(),
    );
  }

  int get memberCount => count?.members ?? members.length;

  @override
  List<Object?> get props =>
      [id, name, isPublic, createdAt, description, sportType, profilePicture, city, country, locationName, maxMembers];
}
