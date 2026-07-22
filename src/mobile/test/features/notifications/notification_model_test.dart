import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/notification_model.dart';

void main() {
  group('NotificationModel', () {
    test('parses nested event/session, group, tournament, and user fields', () {
      final model = NotificationModel.fromJson(const {
        'id': 'n1',
        'type': 'join',
        'notificationType': 'session',
        'read': false,
        'createdAt': '2026-05-08T10:00:00.000Z',
        'session': {'id': 'e1', 'title': 'Sunday Match'},
        'group': {'id': 'g1', 'name': 'Sunday League'},
        'tournament': {'id': 't1', 'name': 'Summer Cup'},
        'teamUpRequest': {'id': 'tu1'},
        'user': {'name': 'Jamie'},
      });

      expect(model.eventId, 'e1');
      expect(model.eventTitle, 'Sunday Match');
      expect(model.groupId, 'g1');
      expect(model.tournamentId, 't1');
      expect(model.teamupId, 'tu1');
      expect(model.actorName, 'Jamie');
      expect(model.summary, 'Jamie joined Sunday Match');
    });

    test('falls back to legacy "event" key when "session" is absent', () {
      final model = NotificationModel.fromJson(const {
        'id': 'n2',
        'type': 'leave',
        'notificationType': 'session',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'event': {'id': 'e2', 'title': 'Legacy Event'},
        'user': {'name': 'Sam'},
      });

      expect(model.eventId, 'e2');
      expect(model.summary, 'Sam left Legacy Event');
    });

    test('defaults read to false and derives summary from params when actor/title missing', () {
      final model = NotificationModel.fromJson(const {
        'id': 'n3',
        'type': 'invited',
        'notificationType': 'session',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'params': {'name': 'Robin', 'eventTitle': 'Practice'},
      });

      expect(model.read, isFalse);
      expect(model.summary, 'Robin invited you to Practice');
    });

    test('unknown type falls back to a humanized type string', () {
      final model = NotificationModel.fromJson(const {
        'id': 'n4',
        'type': 'some_new_type',
        'notificationType': 'session',
        'createdAt': '2026-05-08T10:00:00.000Z',
      });

      expect(model.summary, 'some new type');
    });

    test('tournament-related summaries reference the tournament name', () {
      final model = NotificationModel.fromJson(const {
        'id': 'n5',
        'type': 'match_scheduled',
        'notificationType': 'tournament',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'tournament': {'id': 't1', 'name': 'Summer Cup'},
      });

      expect(model.summary, 'A match was scheduled in "Summer Cup"');
    });
  });
}
