import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/attendance_model.dart';

void main() {
  group('AttendanceModel', () {
    test('parses nested user fields and defaults status to on_time', () {
      final model = AttendanceModel.fromJson(const {
        'id': 'a1',
        'eventId': 'e1',
        'updatedAt': '2026-05-08T10:00:00.000Z',
        'user': {'id': 'u1', 'name': 'Alex', 'email': 'alex@example.com'},
      });

      expect(model.userId, 'u1');
      expect(model.userName, 'Alex');
      expect(model.status, 'on_time');
    });

    test('falls back to legacy attendanceId/sessionId keys', () {
      final model = AttendanceModel.fromJson(const {
        'attendanceId': 'a2',
        'sessionId': 'e2',
        'userId': 'u2',
        'status': 'late',
        'updatedAt': '2026-05-08T10:00:00.000Z',
      });

      expect(model.id, 'a2');
      expect(model.eventId, 'e2');
      expect(model.status, 'late');
    });

    test('defaults updatedAt to now when missing', () {
      final before = DateTime.now();
      final model = AttendanceModel.fromJson(const {
        'id': 'a3',
        'eventId': 'e3',
        'userId': 'u3',
      });
      final after = DateTime.now();

      expect(
        model.updatedAt.isAfter(before.subtract(const Duration(seconds: 1))),
        isTrue,
      );
      expect(
        model.updatedAt.isBefore(after.add(const Duration(seconds: 1))),
        isTrue,
      );
    });
  });

  group('AttendanceStatsModel', () {
    test('parses stats from a nested "stats" key', () {
      final model = AttendanceStatsModel.fromJson(const {
        'stats': {
          'totalParticipants': 10,
          'onTime': 6,
          'late': 2,
          'noShow': 2,
          'attendanceRate': 0.8,
        },
      });

      expect(model.totalParticipants, 10);
      expect(model.onTime, 6);
      expect(model.attendanceRate, 0.8);
    });

    test('parses stats from the top level when no "stats" key is present', () {
      final model = AttendanceStatsModel.fromJson(const {
        'totalParticipants': 5,
        'onTime': 5,
        'late': 0,
        'noShow': 0,
        'attendanceRate': 1.0,
      });

      expect(model.totalParticipants, 5);
      expect(model.late, 0);
    });
  });
}
