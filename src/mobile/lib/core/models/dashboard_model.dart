import 'package:equatable/equatable.dart';

const _teamUpContextLabel = 'TeamUp';
const _tournamentContextLabel = 'Tournament';
const _sessionContextLabel = 'Session';

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
      upcomingCount: (json['upcomingCount'] as num?)?.toInt() ??
          (json['upcomingSessions'] as num?)?.toInt() ??
          (json['upcomingEvents'] as num?)?.toInt() ??
          0,
      groupCount: (json['groupCount'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [totalSessions, upcomingCount, groupCount];
}

/// Upcoming dashboard event (session, teamup, tournament).
class DashboardUpcomingEventModel extends Equatable {
  const DashboardUpcomingEventModel({
    required this.id,
    required this.title,
    required this.startTime,
    required this.eventType,
    required this.contextName,
  });

  final String id;
  final String title;
  final DateTime startTime;
  final String eventType;
  final String contextName;

  factory DashboardUpcomingEventModel.fromJson(Map<String, dynamic> json) {
    final group = json['group'] as Map<String, dynamic>?;
    final startRaw = (json['startTime'] as String?) ??
        (json['dateTime'] as String?) ??
        (json['startDate'] as String?);
    final eventType = (json['eventType'] as String?) ?? 'session';
    final title = (json['title'] as String?) ??
        (json['name'] as String?) ??
        switch (eventType) {
          'teamup' => 'Untitled TeamUp',
          'tournament' => 'Untitled Tournament',
          _ => 'Untitled Session',
        };
    final contextName = (json['contextName'] as String?) ??
        (group?['name'] as String?) ??
        (json['locationName'] as String?) ??
        (json['city'] as String?) ??
        switch (eventType) {
          'teamup' => _teamUpContextLabel,
          'tournament' => _tournamentContextLabel,
          _ => _sessionContextLabel,
        };
    if (startRaw == null) {
      throw FormatException(
        'dashboard upcoming event missing startTime: ${json['id'] ?? title}',
      );
    }

    return DashboardUpcomingEventModel(
      id: json['id'] as String,
      title: title,
      startTime: DateTime.parse(startRaw),
      eventType: eventType,
      contextName: contextName,
    );
  }

  String get destinationPath {
    switch (eventType) {
      case 'teamup':
        return '/teamup/$id';
      case 'tournament':
        return '/tournaments/$id';
      case 'session':
      default:
        return '/sessions/$id';
    }
  }

  @override
  List<Object?> get props => [id, title, startTime, eventType, contextName];
}

/// Aggregate dashboard payload returned by `GET /api/auth/me/dashboard`.
class DashboardModel extends Equatable {
  const DashboardModel({
    required this.upcomingEvents,
    required this.recentGroups,
    required this.unreadNotifications,
    required this.stats,
  });

  final List<DashboardUpcomingEventModel> upcomingEvents;
  final List<DashboardGroupModel> recentGroups;
  final int unreadNotifications;
  final DashboardStats stats;

  // Backward-compatible alias for older call sites.
  List<DashboardUpcomingEventModel> get upcomingSessions => upcomingEvents;

  factory DashboardModel.fromJson(Map<String, dynamic> json) {
    final rawUpcoming = json['upcomingEvents'] ?? json['upcomingSessions'];
    final sessions = (rawUpcoming as List<dynamic>? ?? [])
        .map(
          (e) => DashboardUpcomingEventModel.fromJson(e as Map<String, dynamic>),
        )
        .toList();
    sessions.sort((a, b) {
      final byStart = a.startTime.compareTo(b.startTime);
      if (byStart != 0) return byStart;
      return a.id.compareTo(b.id);
    });

    final groups = (json['recentGroups'] as List<dynamic>? ?? [])
        .map((e) => DashboardGroupModel.fromJson(e as Map<String, dynamic>))
        .toList();

    return DashboardModel(
      upcomingEvents: sessions,
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
      [upcomingEvents, recentGroups, unreadNotifications, stats];
}
