import 'package:equatable/equatable.dart';

class AttendanceModel extends Equatable {
  const AttendanceModel({
    required this.id,
    required this.eventId,
    required this.userId,
    required this.status,
    required this.updatedAt,
    this.userName,
    this.userEmail,
    this.userPicture,
  });

  final String id;
  final String eventId;
  final String userId;
  final String status; // 'on_time' | 'late'
  final DateTime updatedAt;
  final String? userName;
  final String? userEmail;
  final String? userPicture;

  factory AttendanceModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return AttendanceModel(
      id: (json['id'] as String?) ?? (json['attendanceId'] as String?) ?? '',
      eventId: (json['eventId'] as String?) ?? (json['sessionId'] as String?) ?? '',
      userId: (json['userId'] as String?) ?? (user?['id'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'on_time',
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : DateTime.now(),
      userName: user?['name'] as String?,
      userEmail: user?['email'] as String?,
      userPicture: user?['profilePicture'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, eventId, userId, status, updatedAt];
}

class AttendanceStatsModel extends Equatable {
  const AttendanceStatsModel({
    required this.totalParticipants,
    required this.onTime,
    required this.late,
    required this.noShow,
    required this.attendanceRate,
  });

  final int totalParticipants;
  final int onTime;
  final int late;
  final int noShow;
  final double attendanceRate;

  factory AttendanceStatsModel.fromJson(Map<String, dynamic> json) {
    final stats = json['stats'] as Map<String, dynamic>? ?? json;
    return AttendanceStatsModel(
      totalParticipants: (stats['totalParticipants'] as num?)?.toInt() ?? 0,
      onTime: (stats['onTime'] as num?)?.toInt() ?? 0,
      late: (stats['late'] as num?)?.toInt() ?? 0,
      noShow: (stats['noShow'] as num?)?.toInt() ?? 0,
      attendanceRate: (stats['attendanceRate'] as num?)?.toDouble() ?? 0.0,
    );
  }

  @override
  List<Object?> get props =>
      [totalParticipants, onTime, late, noShow, attendanceRate];
}
