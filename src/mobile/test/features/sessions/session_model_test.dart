import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/session_model.dart';

void main() {
  group('SessionModel', () {
    Map<String, dynamic> baseJson() => {
          'id': 's1',
          'title': 'Sunday Match',
          'startTime': '2026-06-01T10:00:00.000Z',
          'endTime': '2026-06-01T12:00:00.000Z',
          'isPublic': true,
          'creator': const {
            'id': 'creator-1',
            'name': 'Alex',
            'email': 'alex@example.com',
          },
          'group': const {'id': 'group-1', 'name': 'Sunday League'},
        };

    test('parses required fields and defaults optional lists', () {
      final model = SessionModel.fromJson(baseJson());

      expect(model.id, 's1');
      expect(model.creator.name, 'Alex');
      expect(model.group.name, 'Sunday League');
      expect(model.participants, isEmpty);
      expect(model.guestParticipants, isEmpty);
      expect(model.maxPlayers, isNull);
    });

    test('parses participants, guests, and _count', () {
      final json = {
        ...baseJson(),
        'maxPlayers': 10,
        'participants': [
          {
            'id': 'p1',
            'userId': 'user-1',
            'status': 'confirmed',
            'user': {'name': 'Jamie', 'profilePicture': null},
          },
        ],
        'guestParticipants': [
          {'id': 'gp1', 'name': 'Guest One', 'status': 'confirmed'},
        ],
        '_count': {'participants': 3, 'guestParticipants': 1, 'comments': 5},
      };

      final model = SessionModel.fromJson(json);

      expect(model.participants, hasLength(1));
      expect(model.participants.first.userId, 'user-1');
      expect(model.guestParticipants, hasLength(1));
      expect(model.count!.participants, 3);
      // count takes precedence over deriving from participant lists.
      expect(model.participantCount, 4);
      expect(model.isFull, isFalse);
    });

    test('participantCount falls back to confirmed participants/guests when no _count', () {
      final json = {
        ...baseJson(),
        'maxPlayers': 2,
        'participants': [
          {'id': 'p1', 'userId': 'user-1', 'status': 'confirmed'},
          {'id': 'p2', 'userId': 'user-2', 'status': 'cancelled'},
        ],
        'guestParticipants': [
          {'id': 'gp1', 'name': 'Guest One', 'status': 'confirmed'},
        ],
      };

      final model = SessionModel.fromJson(json);

      expect(model.participantCount, 2);
      expect(model.isFull, isTrue);
    });

    test('isParticipant ignores cancelled participants', () {
      final json = {
        ...baseJson(),
        'participants': [
          {'id': 'p1', 'userId': 'user-1', 'status': 'confirmed'},
          {'id': 'p2', 'userId': 'user-2', 'status': 'cancelled'},
        ],
      };

      final model = SessionModel.fromJson(json);

      expect(model.isParticipant('user-1'), isTrue);
      expect(model.isParticipant('user-2'), isFalse);
      expect(model.isParticipant('user-3'), isFalse);
    });
  });
}
