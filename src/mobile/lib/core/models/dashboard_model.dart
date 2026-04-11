import 'package:equatable/equatable.dart';

import 'session_model.dart';

/// Lightweight group summary returned by the dashboard endpoint.
class DashboardGroupModel extends Equatable {
  const DashboardGroupModel({
    required this.id,
    required this.name,
    required this.isPublic,
    required this.createdAt,
    this.description,
    this.sportType,
    this.profilePicture,
    this.city,
    this.memberCount = 0,
    this.eventCount = 0,
  });

  final String id;
  final String name;
  final bool isPublic;
  final DateTime createdAt;
  final String? description;
  final String? sportType;
  final String? profilePicture;
  final String? city;
  final int memberCount;
  final int eventCount;

  factory DashboardGroupModel.fromJson(Map<String, dynamic> json) {
    final count = json['_count'] as Map<String, dynamic>?;
    return DashboardGroupModel(
      id: json['id'] as String,
      name: json['name'] as String,
      isPublic: (json['isPublic'] as bool?) ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      description: json['description'] as String?,
      sportType: json['sportType'] as String?,
      profilePicture: json['profilePicture'] as String?,
      city: json['city'] as String?,
      memberCount: (count?['members'] as num?)?.toInt() ?? 0,
      eventCount: (count?['sessions'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props =>
      [id, name, isPublic, createdAt, memberCount, eventCount];
}

/// Stats section of the dashboard response.
class DashboardStats extends Equatable {
  const DashboardStats({
    required this.totalSessions,
    required this.upcomingCount,
    required this.groupCount,
  });

  final int totalSessions;
  final int upcomingCount;
  final int groupCount;

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      totalSessions: (json['totalSessions'] as num?)?.toInt() ?? 0,
      upcomingCount: (json['upcomingCount'] as num?)?.toInt() ?? 0,
      groupCount: (json['groupCount'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [totalSessions, upcomingCount, groupCount];
}

/// Aggregate dashboard payload returned by `GET /api/auth/me/dashboard`.
class DashboardModel extends Equatable {
  const DashboardModel({
    required this.upcomingSessions,
    required this.recentGroups,
    required this.unreadNotifications,
    required this.stats,
  });

  final List<SessionModel> upcomingSessions;
  final List<DashboardGroupModel> recentGroups;
  final int unreadNotifications;
  final DashboardStats stats;

  factory DashboardModel.fromJson(Map<String, dynamic> json) {
    final sessions = (json['upcomingSessions'] as List<dynamic>? ?? [])
        .map((e) => SessionModel.fromJson(e as Map<String, dynamic>))
        .toList();

    final groups = (json['recentGroups'] as List<dynamic>? ?? [])
        .map((e) => DashboardGroupModel.fromJson(e as Map<String, dynamic>))
        .toList();

    return DashboardModel(
      upcomingSessions: sessions,
      recentGroups: groups,
      unreadNotifications: (json['unreadNotifications'] as num?)?.toInt() ?? 0,
      stats: json['stats'] != null
          ? DashboardStats.fromJson(json['stats'] as Map<String, dynamic>)
          : const DashboardStats(
              totalSessions: 0,
              upcomingCount: 0,
              groupCount: 0,
            ),
    );
  }

  @override
  List<Object?> get props =>
      [upcomingSessions, recentGroups, unreadNotifications, stats];
}
