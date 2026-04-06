class ReminderModel {
  const ReminderModel({
    required this.id,
    required this.eventId,
    this.eventTitle,
    required this.userId,
    required this.minutesBefore,
    required this.reminderTime,
    required this.sent,
    required this.createdAt,
  });

  final String id;
  final String eventId;
  final String? eventTitle;
  final String userId;
  final int minutesBefore;
  final DateTime reminderTime;
  final bool sent;
  final DateTime createdAt;

  factory ReminderModel.fromJson(Map<String, dynamic> json) {
    final event = json['event'] as Map<String, dynamic>?;
    return ReminderModel(
      id: json['id'] as String,
      eventId: event?['id'] as String? ?? json['eventId'] as String,
      eventTitle:
          event?['title'] as String? ?? json['eventTitle'] as String?,
      userId: json['userId'] as String,
      minutesBefore: (json['minutesBefore'] as num).toInt(),
      reminderTime: DateTime.parse(json['reminderTime'] as String),
      sent: (json['sent'] as bool?) ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
