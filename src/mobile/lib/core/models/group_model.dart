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
    this.members = const [],
    this.count,
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
  final List<GroupMemberModel> members;
  final GroupCountModel? count;

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
      members: membersList,
      count: json['_count'] != null
          ? GroupCountModel.fromJson(json['_count'] as Map<String, dynamic>)
          : null,
    );
  }

  int get memberCount => count?.members ?? members.length;

  @override
  List<Object?> get props =>
      [id, name, isPublic, createdAt, description, sportType, profilePicture, city, country, locationName, maxMembers];
}
