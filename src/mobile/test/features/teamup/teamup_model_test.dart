import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/teamup_model.dart';

void main() {
  group('TeamUpRequestModel', () {
    test('parses creator and dateTime fields', () {
      final model = TeamUpRequestModel.fromJson(const {
        'id': 'request-1',
        'title': 'Need a midfielder',
        'sportType': 'football',
        'requestType': 'need_players',
        'status': 'open',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'creatorId': 'user-1',
        'creator': const {
          'id': 'user-1',
          'name': 'Alex',
        },
        'dateTime': '2026-05-10T18:00:00.000Z',
        'positions': const [
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
      final model = TeamUpResponseModel.fromJson(const {
        'id': 'response-1',
        'teamUpRequestId': 'request-1',
        'message': 'I can play midfield',
        'status': 'pending',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'userId': 'user-2',
        'user': const {
          'id': 'user-2',
          'name': 'Jamie',
        },
        'requestPositionId': 'position-1',
        'requestPosition': const {
          'id': 'position-1',
          'name': 'Midfielder',
        },
      });

      expect(model.responderId, 'user-2');
      expect(model.responderName, 'Jamie');
      expect(model.requestPositionName, 'Midfielder');
    });

    test('parses waitlisted status with waitlistRank', () {
      final model = TeamUpResponseModel.fromJson(const {
        'id': 'response-2',
        'teamUpRequestId': 'request-1',
        'message': 'Available if spot opens',
        'status': 'waitlisted',
        'waitlistRank': 3,
        'createdAt': '2026-05-08T10:00:00.000Z',
        'userId': 'user-3',
        'user': const {'id': 'user-3', 'name': 'Sam'},
      });

      expect(model.status, 'waitlisted');
      expect(model.waitlistRank, 3);
    });

    test('parses rsvpStatus and attendanceStatus', () {
      final model = TeamUpResponseModel.fromJson(const {
        'id': 'response-3',
        'teamUpRequestId': 'request-1',
        'message': 'Ready to go',
        'status': 'accepted',
        'rsvpStatus': 'going',
        'attendanceStatus': 'attended',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'userId': 'user-4',
        'user': const {'id': 'user-4', 'name': 'Jordan'},
      });

      expect(model.rsvpStatus, 'going');
      expect(model.attendanceStatus, 'attended');
    });
  });

  group('TeamUpApplicationModel', () {
    test('parses nested request context', () {
      final model = TeamUpApplicationModel.fromJson(const {
        'id': 'response-1',
        'teamUpRequestId': 'request-1',
        'message': 'Available',
        'status': 'cancelled',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'teamUpRequest': const {
          'id': 'request-1',
          'title': 'Need a midfielder',
          'sportType': 'football',
          'requestType': 'need_players',
          'status': 'open',
          'dateTime': '2026-05-10T18:00:00.000Z',
          'city': 'New York',
          'creator': const {
            'name': 'Alex',
          },
        },
      });

      expect(model.requestId, 'request-1');
      expect(model.requestTitle, 'Need a midfielder');
      expect(model.requestCreatorName, 'Alex');
      expect(model.status, 'cancelled');
    });

    test('parses waitlisted status with waitlistRank and reapply flags', () {
      final model = TeamUpApplicationModel.fromJson(const {
        'id': 'response-5',
        'teamUpRequestId': 'request-2',
        'message': 'Happy to join if space opens',
        'status': 'waitlisted',
        'waitlistRank': 1,
        'reapplicationEligible': true,
        'blocksReapply': false,
        'createdAt': '2026-05-08T10:00:00.000Z',
        'teamUpRequest': const {
          'id': 'request-2',
          'title': 'Goalkeeper needed',
          'sportType': 'football',
          'requestType': 'need_players',
          'status': 'open',
          'creator': const {'name': 'Coach'},
        },
      });

      expect(model.status, 'waitlisted');
      expect(model.waitlistRank, 1);
      expect(model.reapplicationEligible, isTrue);
      expect(model.blocksReapply, isFalse);
    });
  });

  group('TeamUpBrowseResult', () {
    test('parses paginated response with nextCursor', () {
      final result = TeamUpBrowseResult.fromJson({
        'data': [
          {
            'id': 'request-1',
            'title': 'Kick around',
            'sportType': 'football',
            'requestType': 'need_players',
            'status': 'open',
            'createdAt': '2026-05-08T10:00:00.000Z',
            'creatorId': 'user-1',
            'creator': {'id': 'user-1', 'name': 'Alex'},
          }
        ],
        'pagination': {
          'limit': 50,
          'offset': 0,
          'total': 120,
          'hasMore': true,
          'nextCursor': 'eyJpZCI6InJlcXVlc3QtMSJ9',
        },
      });

      expect(result.data, hasLength(1));
      expect(result.hasMore, isTrue);
      expect(result.nextCursor, 'eyJpZCI6InJlcXVlc3QtMSJ9');
      expect(result.total, 120);
    });

    test('parses plain list response as non-paginated', () {
      final result = TeamUpBrowseResult.fromJson([
        {
          'id': 'request-2',
          'title': 'Basketball 3v3',
          'sportType': 'basketball',
          'requestType': 'looking_for_play',
          'status': 'open',
          'createdAt': '2026-05-09T12:00:00.000Z',
          'creatorId': 'user-2',
          'creator': {'id': 'user-2', 'name': 'Pat'},
        }
      ]);

      expect(result.data, hasLength(1));
      expect(result.hasMore, isFalse);
      expect(result.nextCursor, isNull);
    });
  });

  group('TeamUpAttendanceHistoryModel', () {
    test('parses reliability score and history records', () {
      final model = TeamUpAttendanceHistoryModel.fromJson({
        'reliabilityScore': 85.5,
        'totals': {'attended': 7, 'late': 1, 'no_show': 1, 'excused': 0},
        'history': [
          {
            'attendanceStatus': 'attended',
            'createdAt': '2026-04-01T10:00:00.000Z',
            'teamUpRequest': {
              'id': 'request-10',
              'title': 'Sunday football',
              'sportType': 'football',
              'dateTime': '2026-04-01T15:00:00.000Z',
              'city': 'London',
            },
          },
        ],
      });

      expect(model.reliabilityScore, closeTo(85.5, 0.001));
      expect(model.totals['attended'], 7);
      expect(model.totals['no_show'], 1);
      expect(model.history, hasLength(1));
      expect(model.history.first.attendanceStatus, 'attended');
      expect(model.history.first.requestCity, 'London');
    });
  });

  group('TeamUpSavedSearchModel', () {
    test('parses saved search fields', () {
      final model = TeamUpSavedSearchModel.fromJson(const {
        'id': 'search-1',
        'name': 'Football in London',
        'sportType': 'football',
        'requestType': 'need_players',
        'skillLevel': 'intermediate',
        'city': 'London',
        'country': 'GB',
        'search': null,
        'notifyOnMatch': true,
        'createdAt': '2026-05-01T09:00:00.000Z',
      });

      expect(model.id, 'search-1');
      expect(model.name, 'Football in London');
      expect(model.sportType, 'football');
      expect(model.city, 'London');
      expect(model.notifyOnMatch, isTrue);
    });
  });

  group('TeamUpAnalyticsModel', () {
    test('parses funnel and fill-time data', () {
      final model = TeamUpAnalyticsModel.fromJson({
        'funnel': {
          'views': 500,
          'applications': 80,
          'accepted': 40,
          'attended': 35,
          'conversion': {
            'viewToApply': 16.0,
            'applyToAccept': 50.0,
            'acceptToAttend': 87.5,
          },
        },
        'fillTime': {'averageHours': 3.2, 'samples': []},
      });

      expect(model.funnel.views, 500);
      expect(model.funnel.accepted, 40);
      expect(model.funnel.applyToAccept, closeTo(50.0, 0.001));
      expect(model.averageFillTimeHours, closeTo(3.2, 0.001));
    });
  });

  group('TeamUpReplacementSuggestionModel', () {
    test('parses user and scores', () {
      final model = TeamUpReplacementSuggestionModel.fromJson(const {
        'user': const {
          'id': 'user-99',
          'name': 'Casey',
          'profilePicture': 'https://example.com/pic.jpg',
        },
        'matchScore': 92.3,
        'reliabilityScore': 78.0,
        'matchReasons': const ['same city', 'similar skill level'],
      });

      expect(model.userId, 'user-99');
      expect(model.userName, 'Casey');
      expect(model.matchScore, closeTo(92.3, 0.001));
      expect(model.reliabilityScore, closeTo(78.0, 0.001));
      expect(model.matchReasons, contains('same city'));
    });
  });
}
