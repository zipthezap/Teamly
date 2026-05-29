import 'package:equatable/equatable.dart';

class NotificationModel extends Equatable {
  const NotificationModel({
    required this.id,
    required this.type,
    required this.notificationType,
    required this.read,
    required this.createdAt,
    this.eventId,
    this.eventTitle,
    this.groupId,
    this.groupName,
    this.tournamentId,
    this.tournamentName,
    this.teamupId,
    this.actorName,
    this.params,
    this.metadata,
  });

  final String id;
  final String type;
  final String notificationType;
  final bool read;
  final DateTime createdAt;
  final String? eventId;
  final String? eventTitle;
  final String? groupId;
  final String? groupName;
  final String? tournamentId;
  final String? tournamentName;
  final String? teamupId;
  final String? actorName;
  final Map<String, dynamic>? params;
  final Map<String, dynamic>? metadata;

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    final event = (json['event'] ?? json['session']) as Map<String, dynamic>?;
    final group = json['group'] as Map<String, dynamic>?;
    final tournament = json['tournament'] as Map<String, dynamic>?;
    final teamUpRequest = json['teamUpRequest'] as Map<String, dynamic>?;
    final user = json['user'] as Map<String, dynamic>?;
    final rawParams = json['params'];
    final rawMetadata = json['metadata'];

    return NotificationModel(
      id: json['id'] as String,
      type: json['type'] as String,
      notificationType: json['notificationType'] as String,
      read: (json['read'] as bool?) ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      eventId: event?['id'] as String?,
      eventTitle: event?['title'] as String?,
      groupId: group?['id'] as String?,
      groupName: group?['name'] as String?,
      tournamentId: tournament?['id'] as String?,
      tournamentName: tournament?['name'] as String?,
      teamupId: teamUpRequest?['id'] as String?,
      actorName: user?['name'] as String?,
      params: rawParams is Map<String, dynamic> ? rawParams : null,
      metadata: rawMetadata is Map<String, dynamic> ? rawMetadata : null,
    );
  }

  /// Human-readable summary derived from the type and params.
  String get summary {
    final name = actorName ?? params?['name'] as String? ?? 'Someone';
    final title =
        eventTitle ?? params?['eventTitle'] as String? ?? 'an event';
    final gName = groupName ?? params?['groupName'] as String? ?? 'a group';
    final tName = tournamentName ?? params?['tournamentName'] as String? ?? 'a tournament';

    switch (type) {
      case 'join':
        return '$name joined $title';
      case 'leave':
        return '$name left $title';
      case 'session_updated':
        return 'Event "$title" was updated';
      case 'session_cancelled':
        return 'Event "$title" was cancelled';
      case 'comment':
        return '$name commented on $title';
      case 'status_change':
        return 'Status changed for "$title"';
      case 'created':
        return notificationType == 'group'
            ? 'New group "$gName" was created nearby'
            : 'New event "$title" was created';
      case 'cancelled':
        return 'Event "$title" was cancelled';
      case 'updated':
        return 'Event "$title" was updated';
      case 'invited':
        return '$name invited you to $title';
      case 'invite_accepted':
        return '$name accepted your invite to $title';
      case 'new_member':
        return '$name joined $gName';
      case 'nearby_created':
        return 'New group "$gName" near you';
      // TeamUp types
      case 'teamup_request':
        return '$name sent a TeamUp request';
      case 'teamup_accepted':
        return '$name accepted your TeamUp request';
      case 'teamup_declined':
        return '$name declined your TeamUp request';
      case 'teamup_response':
        return '$name responded to your TeamUp request';
      case 'teamup_comment':
        return '$name commented on a TeamUp request';
      // Tournament types
      case 'team_registered':
        return 'A team registered for "$tName"';
      case 'score_submitted':
        return 'A score was submitted in "$tName"';
      case 'tournament_cancelled':
        return 'Tournament "$tName" was cancelled';
      default:
        return type.replaceAll('_', ' ');
    }
  }

  @override
  List<Object?> get props => [
        id,
        type,
        notificationType,
        read,
        createdAt,
        eventId,
        groupId,
        tournamentId,
        teamupId,
      ];
}
