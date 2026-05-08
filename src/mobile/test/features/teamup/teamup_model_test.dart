import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/teamup_model.dart';

void main() {
  group('TeamUpRequestModel', () {
    test('parses creator and dateTime fields', () {
      final model = TeamUpRequestModel.fromJson({
        'id': 'request-1',
        'title': 'Need a midfielder',
        'sportType': 'football',
        'requestType': 'need_players',
        'status': 'open',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'creatorId': 'user-1',
        'creator': {
          'id': 'user-1',
          'name': 'Alex',
        },
        'dateTime': '2026-05-10T18:00:00.000Z',
        'positions': [
          {
            'id': 'position-1',
            'name': 'Midfielder',
            'slotsNeeded': 2,
            'acceptedCount': 1,
            'slotsAvailable': 1,
            'isOpen': true,
          }
        ],
      });

      expect(model.creatorId, 'user-1');
      expect(model.creatorName, 'Alex');
      expect(model.dateTime, DateTime.parse('2026-05-10T18:00:00.000Z'));
      expect(model.positions, hasLength(1));
      expect(model.positions!.first.hasAvailability, isTrue);
    });
  });

  group('TeamUpResponseModel', () {
    test('parses responder from user field', () {
      final model = TeamUpResponseModel.fromJson({
        'id': 'response-1',
        'teamUpRequestId': 'request-1',
        'message': 'I can play midfield',
        'status': 'pending',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'userId': 'user-2',
        'user': {
          'id': 'user-2',
          'name': 'Jamie',
        },
        'requestPositionId': 'position-1',
        'requestPosition': {
          'id': 'position-1',
          'name': 'Midfielder',
        },
      });

      expect(model.responderId, 'user-2');
      expect(model.responderName, 'Jamie');
      expect(model.requestPositionName, 'Midfielder');
    });
  });

  group('TeamUpApplicationModel', () {
    test('parses nested request context', () {
      final model = TeamUpApplicationModel.fromJson({
        'id': 'response-1',
        'teamUpRequestId': 'request-1',
        'message': 'Available',
        'status': 'cancelled',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'teamUpRequest': {
          'id': 'request-1',
          'title': 'Need a midfielder',
          'sportType': 'football',
          'requestType': 'need_players',
          'status': 'open',
          'dateTime': '2026-05-10T18:00:00.000Z',
          'city': 'New York',
          'creator': {
            'name': 'Alex',
          },
        },
      });

      expect(model.requestId, 'request-1');
      expect(model.requestTitle, 'Need a midfielder');
      expect(model.requestCreatorName, 'Alex');
      expect(model.status, 'cancelled');
    });
  });
}
