import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/reminder_model.dart';

void main() {
  group('ReminderModel', () {
    test('parses nested session start time and computes minutesBefore', () {
      final model = ReminderModel.fromJson(const {
        'id': 'r1',
        'userId': 'u1',
        'reminderTime': '2026-05-08T09:30:00.000Z',
        'session': {'id': 'e1', 'title': 'Sunday Match', 'startTime': '2026-05-08T10:00:00.000Z'},
        'sent': false,
        'createdAt': '2026-05-01T00:00:00.000Z',
      });

      expect(model.eventId, 'e1');
      expect(model.eventTitle, 'Sunday Match');
      expect(model.eventStartTime, DateTime.parse('2026-05-08T10:00:00.000Z'));
      expect(model.minutesBefore, 30);
      expect(model.sent, isFalse);
    });

    test('falls back to legacy "event" key and "remindAt" field', () {
      final model = ReminderModel.fromJson(const {
        'id': 'r2',
        'userId': 'u1',
        'remindAt': '2026-05-08T09:00:00.000Z',
        'event': {'id': 'e2', 'title': 'Legacy Event', 'startTime': '2026-05-08T10:00:00.000Z'},
        'createdAt': '2026-05-01T00:00:00.000Z',
      });

      expect(model.eventId, 'e2');
      expect(model.eventTitle, 'Legacy Event');
      expect(model.minutesBefore, 60);
    });

    test('defaults minutesBefore to 30 when no event start time is available', () {
      final model = ReminderModel.fromJson(const {
        'id': 'r3',
        'userId': 'u1',
        'reminderTime': '2026-05-08T09:30:00.000Z',
        'createdAt': '2026-05-01T00:00:00.000Z',
      });

      expect(model.eventStartTime, isNull);
      expect(model.minutesBefore, 30);
    });

    test('coerces non-string id/userId and defaults sent to false', () {
      final model = ReminderModel.fromJson(const {
        'id': 42,
        'userId': null,
        'reminderTime': '2026-05-08T09:30:00.000Z',
        'createdAt': '2026-05-01T00:00:00.000Z',
      });

      expect(model.id, '42');
      expect(model.userId, '');
      expect(model.sent, isFalse);
    });

    test('explicit minutesBefore takes precedence over the computed value', () {
      final model = ReminderModel.fromJson(const {
        'id': 'r4',
        'userId': 'u1',
        'minutesBefore': 15,
        'reminderTime': '2026-05-08T09:45:00.000Z',
        'session': {'id': 'e1', 'startTime': '2026-05-08T10:00:00.000Z'},
        'createdAt': '2026-05-01T00:00:00.000Z',
      });

      expect(model.minutesBefore, 15);
    });
  });
}
