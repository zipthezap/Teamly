import 'package:equatable/equatable.dart';

class EventParticipantDetailModel extends Equatable {
  const EventParticipantDetailModel({
    required this.id,
    required this.userId,
    required this.eventId,
    required this.status,
    required this.joinedAt,
    this.userName,
    this.userEmail,
    this.userPicture,
    this.userCity,
    this.userCountry,
  });

  final String id;
  final String userId;
  final String eventId;
  final String status; // confirmed | pending | declined | invited
  final DateTime joinedAt;
  final String? userName;
  final String? userEmail;
  final String? userPicture;
  final String? userCity;
  final String? userCountry;

  factory EventParticipantDetailModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return EventParticipantDetailModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      eventId: json['eventId'] as String,
      status: json['status'] as String,
      joinedAt: DateTime.parse(json['joinedAt'] as String),
      userName: user?['name'] as String?,
      userEmail: user?['email'] as String?,
      userPicture: user?['profilePicture'] as String?,
      userCity: user?['city'] as String?,
      userCountry: user?['country'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, userId, eventId, status, joinedAt];
}

class EventGuestModel extends Equatable {
  const EventGuestModel({
    required this.id,
    required this.eventId,
    required this.name,
    required this.status,
    required this.joinedAt,
  });

  final String id;
  final String eventId;
  final String name;
  final String status;
  final DateTime joinedAt;

  factory EventGuestModel.fromJson(Map<String, dynamic> json) {
    return EventGuestModel(
      id: json['id'] as String,
      eventId: json['eventId'] as String,
      name: json['name'] as String,
      status: json['status'] as String,
      joinedAt: DateTime.parse(json['joinedAt'] as String),
    );
  }

  @override
  List<Object?> get props => [id, eventId, name, status, joinedAt];
}

class ParticipantSummaryModel extends Equatable {
  const ParticipantSummaryModel({
    required this.total,
    required this.filtered,
    required this.confirmed,
    required this.pending,
    required this.declined,
    required this.invited,
  });

  final int total;
  final int filtered;
  final int confirmed;
  final int pending;
  final int declined;
  final int invited;

  factory ParticipantSummaryModel.fromJson(Map<String, dynamic> json) {
    final byStatus = json['byStatus'] as Map<String, dynamic>? ?? {};
    return ParticipantSummaryModel(
      total: (json['total'] as num?)?.toInt() ?? 0,
      filtered: (json['filtered'] as num?)?.toInt() ?? 0,
      confirmed: (byStatus['confirmed'] as num?)?.toInt() ?? 0,
      pending: (byStatus['pending'] as num?)?.toInt() ?? 0,
      declined: (byStatus['declined'] as num?)?.toInt() ?? 0,
      invited: (byStatus['invited'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [total, filtered, confirmed, pending, declined, invited];
}

class EventStatisticsModel extends Equatable {
  const EventStatisticsModel({
    required this.totalEventsJoined,
    required this.totalEventsCreated,
    required this.upcomingEvents,
    required this.pastEvents,
    required this.confirmedEvents,
    required this.eventTypeBreakdown,
    required this.createdEventsStats,
  });

  final int totalEventsJoined;
  final int totalEventsCreated;
  final int upcomingEvents;
  final int pastEvents;
  final int confirmedEvents;
  final Map<String, int> eventTypeBreakdown;
  final CreatedEventsStatsModel createdEventsStats;

  factory EventStatisticsModel.fromJson(Map<String, dynamic> json) {
    final breakdown = <String, int>{};
    final raw = json['eventTypeBreakdown'] as Map<String, dynamic>?;
    raw?.forEach((k, v) => breakdown[k] = (v as num).toInt());

    return EventStatisticsModel(
      totalEventsJoined: (json['totalEventsJoined'] as num?)?.toInt() ?? 0,
      totalEventsCreated: (json['totalEventsCreated'] as num?)?.toInt() ?? 0,
      upcomingEvents: (json['upcomingEvents'] as num?)?.toInt() ?? 0,
      pastEvents: (json['pastEvents'] as num?)?.toInt() ?? 0,
      confirmedEvents: (json['confirmedEvents'] as num?)?.toInt() ?? 0,
      eventTypeBreakdown: breakdown,
      createdEventsStats: json['createdEventsStats'] != null
          ? CreatedEventsStatsModel.fromJson(
              json['createdEventsStats'] as Map<String, dynamic>)
          : const CreatedEventsStatsModel(
              total: 0, totalParticipants: 0, avgParticipantsPerEvent: 0),
    );
  }

  @override
  List<Object?> get props => [
        totalEventsJoined,
        totalEventsCreated,
        upcomingEvents,
        pastEvents,
        confirmedEvents,
      ];
}

class CreatedEventsStatsModel extends Equatable {
  const CreatedEventsStatsModel({
    required this.total,
    required this.totalParticipants,
    required this.avgParticipantsPerEvent,
  });

  final int total;
  final int totalParticipants;
  final double avgParticipantsPerEvent;

  factory CreatedEventsStatsModel.fromJson(Map<String, dynamic> json) {
    return CreatedEventsStatsModel(
      total: (json['total'] as num?)?.toInt() ?? 0,
      totalParticipants: (json['totalParticipants'] as num?)?.toInt() ?? 0,
      avgParticipantsPerEvent:
          (json['avgParticipantsPerEvent'] as num?)?.toDouble() ?? 0.0,
    );
  }

  @override
  List<Object?> get props => [total, totalParticipants, avgParticipantsPerEvent];
}

class InviteAnalyticsModel extends Equatable {
  const InviteAnalyticsModel({
    required this.totalInvites,
    required this.accepted,
    required this.rejected,
    required this.pending,
    required this.acceptanceRate,
    required this.uniqueRecipientsCount,
    required this.avgTimeToAcceptMs,
    required this.invitesSentPerDay,
    required this.topInvitedDomains,
  });

  final int totalInvites;
  final int accepted;
  final int rejected;
  final int pending;
  final double acceptanceRate;
  final int uniqueRecipientsCount;
  final double avgTimeToAcceptMs;
  final List<InvitesPerDayModel> invitesSentPerDay;
  final List<String> topInvitedDomains;

  factory InviteAnalyticsModel.fromJson(Map<String, dynamic> json) {
    final a = json['analytics'] as Map<String, dynamic>? ?? json;
    final perDay = (a['invitesSentPerDay'] as List<dynamic>?)
            ?.map((e) =>
                InvitesPerDayModel.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];
    final domains =
        (a['topInvitedDomains'] as List<dynamic>?)?.cast<String>() ?? [];

    return InviteAnalyticsModel(
      totalInvites: (a['totalInvites'] as num?)?.toInt() ?? 0,
      accepted: (a['accepted'] as num?)?.toInt() ?? 0,
      rejected: (a['rejected'] as num?)?.toInt() ?? 0,
      pending: (a['pending'] as num?)?.toInt() ?? 0,
      acceptanceRate: (a['acceptanceRate'] as num?)?.toDouble() ?? 0.0,
      uniqueRecipientsCount: (a['uniqueRecipientsCount'] as num?)?.toInt() ?? 0,
      avgTimeToAcceptMs: (a['avgTimeToAccept'] as num?)?.toDouble() ?? 0.0,
      invitesSentPerDay: perDay,
      topInvitedDomains: domains,
    );
  }

  @override
  List<Object?> get props => [totalInvites, accepted, rejected, pending, acceptanceRate];
}

class InvitesPerDayModel extends Equatable {
  const InvitesPerDayModel({required this.date, required this.count});

  final String date;
  final int count;

  factory InvitesPerDayModel.fromJson(Map<String, dynamic> json) {
    return InvitesPerDayModel(
      date: json['date'] as String,
      count: (json['count'] as num).toInt(),
    );
  }

  @override
  List<Object?> get props => [date, count];
}

class NearbyGroupModel extends Equatable {
  const NearbyGroupModel({
    required this.id,
    required this.name,
    required this.distance,
    required this.isPublic,
    this.description,
    this.locationName,
    this.city,
    this.country,
    this.sportType,
    this.creatorName,
    this.creatorPicture,
    this.memberCount,
    this.eventCount,
  });

  final String id;
  final String name;
  final double distance;
  final bool isPublic;
  final String? description;
  final String? locationName;
  final String? city;
  final String? country;
  final String? sportType;
  final String? creatorName;
  final String? creatorPicture;
  final int? memberCount;
  final int? eventCount;

  factory NearbyGroupModel.fromJson(Map<String, dynamic> json) {
    final creator = json['creator'] as Map<String, dynamic>?;
    final count = json['_count'] as Map<String, dynamic>?;
    return NearbyGroupModel(
      id: json['id'] as String,
      name: json['name'] as String,
      distance: (json['distance'] as num?)?.toDouble() ?? 0.0,
      isPublic: (json['isPublic'] as bool?) ?? false,
      description: json['description'] as String?,
      locationName: json['locationName'] as String?,
      city: json['city'] as String?,
      country: json['country'] as String?,
      sportType: json['sportType'] as String?,
      creatorName: creator?['name'] as String?,
      creatorPicture: creator?['profilePicture'] as String?,
      memberCount: (count?['members'] as num?)?.toInt(),
      eventCount: (count?['events'] as num?)?.toInt(),
    );
  }

  @override
  List<Object?> get props => [id, name, distance];
}

class ProfilePictureModel extends Equatable {
  const ProfilePictureModel({
    required this.id,
    required this.url,
    required this.createdAt,
    this.isCurrent,
  });

  final String id;
  final String url;
  final DateTime createdAt;
  final bool? isCurrent;

  factory ProfilePictureModel.fromJson(Map<String, dynamic> json) {
    return ProfilePictureModel(
      id: json['id'] as String,
      url: (json['url'] ?? json['profilePicture']) as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isCurrent: json['isCurrent'] as bool?,
    );
  }

  @override
  List<Object?> get props => [id, url, createdAt];
}

class OAuthStatusModel extends Equatable {
  const OAuthStatusModel({
    required this.googleConnected,
    required this.facebookConnected,
    required this.hasLocalPassword,
    required this.primaryProvider,
    this.hasOAuthProfilePicture,
    this.lastOAuthSync,
  });

  final bool googleConnected;
  final bool facebookConnected;
  final bool hasLocalPassword;
  final String primaryProvider;
  final bool? hasOAuthProfilePicture;
  final DateTime? lastOAuthSync;

  factory OAuthStatusModel.fromJson(Map<String, dynamic> json) {
    final connections = json['connections'] as Map<String, dynamic>? ?? {};
    return OAuthStatusModel(
      googleConnected: (connections['google'] as bool?) ?? false,
      facebookConnected: (connections['facebook'] as bool?) ?? false,
      hasLocalPassword: (connections['local'] as bool?) ?? false,
      primaryProvider: json['primaryProvider'] as String? ?? 'local',
      hasOAuthProfilePicture: json['hasOAuthProfilePicture'] as bool?,
      lastOAuthSync: json['lastOAuthSync'] != null
          ? DateTime.parse(json['lastOAuthSync'] as String)
          : null,
    );
  }

  @override
  List<Object?> get props =>
      [googleConnected, facebookConnected, hasLocalPassword, primaryProvider];
}
