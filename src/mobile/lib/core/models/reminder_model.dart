class ReminderModel {
  const ReminderModel({
    required this.id,
    required this.eventId,
    this.eventTitle,
    required this.userId,
    required this.minutesBefore,
    required this.reminderTime,
    this.eventStartTime,
    required this.sent,
    required this.createdAt,
  });

  final String id;
  final String eventId;
  final String? eventTitle;
  final String userId;
  final int minutesBefore;
  final DateTime reminderTime;
  final DateTime? eventStartTime;
  final bool sent;
  final DateTime createdAt;

  static String _asString(dynamic value) {
    if (value is String) return value;
    if (value == null) return '';
    return value.toString();
  }

  static DateTime? _asDateTime(dynamic value) {
    if (value is DateTime) return value;
    if (value is String && value.isNotEmpty) {
      return DateTime.tryParse(value);
    }
    return null;
  }

  factory ReminderModel.fromJson(Map<String, dynamic> json) {
    final event = json['event'] as Map<String, dynamic>?;
    final session = json['session'] as Map<String, dynamic>?;
    final reminderTime = _asDateTime(json['reminderTime']) ??
        _asDateTime(json['remindAt']) ??
        DateTime.now();
    final eventStartTime =
        _asDateTime(event?['startTime']) ?? _asDateTime(session?['startTime']);
    final computedMinutesBefore = eventStartTime == null
        ? 30
        : eventStartTime.difference(reminderTime).inMinutes.abs();

    return ReminderModel(
      id: _asString(json['id']),
      eventId: _asString(event?['id'] ??
          session?['id'] ??
          json['eventId'] ??
          json['sessionId']),
      eventTitle: (event?['title'] ?? session?['title'] ?? json['eventTitle'])
          as String?,
      userId: _asString(json['userId']),
      minutesBefore:
          (json['minutesBefore'] as num?)?.toInt() ?? computedMinutesBefore,
      reminderTime: reminderTime,
      eventStartTime: eventStartTime,
      sent: (json['sent'] as bool?) ?? false,
      createdAt: _asDateTime(json['createdAt']) ?? reminderTime,
    );
  }
}
