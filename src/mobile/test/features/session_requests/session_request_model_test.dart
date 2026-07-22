import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/session_request_model.dart';

void main() {
  group('SessionRequestModel', () {
    Map<String, dynamic> baseJson() => {
          'id': 'sr1',
          'groupId': 'g1',
          'title': 'Add a Tuesday session',
          'createdAt': '2026-05-01T00:00:00.000Z',
        };

    test('parses creator name/id from the nested "creator" key', () {
      final json = {
        ...baseJson(),
        'creator': {'id': 'u1', 'name': 'Alex'},
      };

      final model = SessionRequestModel.fromJson(json);

      expect(model.createdById, 'u1');
      expect(model.createdByName, 'Alex');
    });

    test('falls back to top-level createdById/createdByName without a creator key', () {
      final json = {
        ...baseJson(),
        'createdById': 'u2',
        'createdByName': 'Jamie',
      };

      final model = SessionRequestModel.fromJson(json);

      expect(model.createdById, 'u2');
      expect(model.createdByName, 'Jamie');
    });

    test('defaults createdById to empty string when neither key is present', () {
      final model = SessionRequestModel.fromJson(baseJson());

      expect(model.createdById, '');
      expect(model.createdByName, isNull);
    });

    test('parses requestedDate from "startTime" and sportType from "eventType"', () {
      final json = {
        ...baseJson(),
        'startTime': '2026-06-01T10:00:00.000Z',
        'eventType': 'soccer',
      };

      final model = SessionRequestModel.fromJson(json);

      expect(model.requestedDate, DateTime.parse('2026-06-01T10:00:00.000Z'));
      expect(model.sportType, 'soccer');
    });

    test('falls back to legacy requestedDate/sportType keys', () {
      final json = {
        ...baseJson(),
        'requestedDate': '2026-06-01T10:00:00.000Z',
        'sportType': 'futsal',
      };

      final model = SessionRequestModel.fromJson(json);

      expect(model.requestedDate, DateTime.parse('2026-06-01T10:00:00.000Z'));
      expect(model.sportType, 'futsal');
    });

    test('defaults status to pending and vote counts to zero', () {
      final model = SessionRequestModel.fromJson(baseJson());

      expect(model.status, 'pending');
      expect(model.voteCount, 0);
      expect(model.totalVotes, 0);
      expect(model.requestedDate, isNull);
    });
  });

  group('VoteModel', () {
    test('parses vote fields and defaults vote to true when missing', () {
      final model = VoteModel.fromJson(const {'id': 'v1', 'userId': 'u1'});

      expect(model.id, 'v1');
      expect(model.userId, 'u1');
      expect(model.vote, isTrue);
    });

    test('parses an explicit false vote', () {
      final model = VoteModel.fromJson(const {
        'id': 'v2',
        'userId': 'u2',
        'vote': false,
      });

      expect(model.vote, isFalse);
    });
  });
}
