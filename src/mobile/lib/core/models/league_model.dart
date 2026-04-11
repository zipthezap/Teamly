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

class LeagueModel extends Equatable {
  const LeagueModel({
    required this.id,
    required this.name,
    required this.sport,
    required this.isPublic,
    required this.memberCount,
    required this.createdAt,
    this.description,
    this.location,
    this.coverImage,
    this.owner,
  });

  final String id;
  final String name;
  final String sport;
  final bool isPublic;
  final int memberCount;
  final DateTime createdAt;
  final String? description;
  final String? location;
  final String? coverImage;
  final LeagueMemberRef? owner;

  factory LeagueModel.fromJson(Map<String, dynamic> json) {
    return LeagueModel(
      id: json['id'] as String,
      name: json['name'] as String,
      sport: json['sport'] as String,
      isPublic: json['isPublic'] as bool? ?? true,
      memberCount: json['memberCount'] as int? ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
      description: json['description'] as String?,
      location: json['location'] as String?,
      coverImage: json['coverImage'] as String?,
      owner: json['owner'] != null
          ? LeagueMemberRef.fromJson(json['owner'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'sport': sport,
        'isPublic': isPublic,
        'memberCount': memberCount,
        'createdAt': createdAt.toIso8601String(),
        if (description != null) 'description': description,
        if (location != null) 'location': location,
        if (coverImage != null) 'coverImage': coverImage,
        if (owner != null) 'owner': owner!.toJson(),
      };

  @override
  List<Object?> get props => [id, name, sport, isPublic, memberCount, createdAt, description, location, coverImage, owner];
}
