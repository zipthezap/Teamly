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
    this.actorName,
    this.params,
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
  final String? actorName;
  final Map<String, dynamic>? params;

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    final event = json['event'] as Map<String, dynamic>?;
    final group = json['group'] as Map<String, dynamic>?;
    final user = json['user'] as Map<String, dynamic>?;
    final rawParams = json['params'];

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
      actorName: user?['name'] as String?,
      params: rawParams is Map<String, dynamic> ? rawParams : null,
    );
  }

  /// Human-readable summary derived from the type and params.
  String get summary {
    final name = actorName ?? params?['name'] as String? ?? 'Someone';
    final title =
        eventTitle ?? params?['eventTitle'] as String? ?? 'an event';
    final gName = groupName ?? params?['groupName'] as String? ?? 'a group';

    switch (type) {
      case 'join':
        return '$name joined $title';
      case 'leave':
        return '$name left $title';
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
      default:
        return type.replaceAll('_', ' ');
    }
  }

  @override
  List<Object?> get props => [id, type, notificationType, read, createdAt];
}
