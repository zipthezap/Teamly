import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/extended_models.dart';

void main() {
  group('SessionParticipantDetailModel', () {
    test('parses nested user fields', () {
      final model = SessionParticipantDetailModel.fromJson(const {
        'id': 'p1',
        'userId': 'u1',
        'sessionId': 's1',
        'status': 'confirmed',
        'joinedAt': '2026-05-08T10:00:00.000Z',
        'user': {
          'name': 'Alex',
          'email': 'alex@example.com',
          'city': 'Toronto',
          'country': 'CA',
        },
      });

      expect(model.userName, 'Alex');
      expect(model.userCity, 'Toronto');
      expect(model.userCountry, 'CA');
    });
  });

  group('ParticipantSummaryModel', () {
    test('parses counts from the nested "byStatus" map', () {
      final model = ParticipantSummaryModel.fromJson(const {
        'total': 10,
        'filtered': 8,
        'byStatus': {
          'confirmed': 5,
          'pending': 2,
          'declined': 1,
          'invited': 2,
        },
      });

      expect(model.total, 10);
      expect(model.confirmed, 5);
      expect(model.pending, 2);
      expect(model.declined, 1);
      expect(model.invited, 2);
    });

    test('defaults all counts to zero when absent', () {
      final model = ParticipantSummaryModel.fromJson(const {});

      expect(model.total, 0);
      expect(model.confirmed, 0);
    });
  });

  group('SessionStatisticsModel', () {
    test('parses sessionTypeBreakdown and nested createdSessionsStats', () {
      final model = SessionStatisticsModel.fromJson(const {
        'totalSessionsJoined': 12,
        'totalSessionsCreated': 3,
        'upcomingSessions': 2,
        'pastSessions': 10,
        'confirmedSessions': 9,
        'sessionTypeBreakdown': {'soccer': 5, 'basketball': 7},
        'createdSessionsStats': {
          'total': 3,
          'totalParticipants': 30,
          'avgParticipantsPerSession': 10.0,
        },
      });

      expect(model.sessionTypeBreakdown['soccer'], 5);
      expect(model.createdSessionsStats.total, 3);
      expect(model.createdSessionsStats.avgParticipantsPerEvent, 10.0);
    });

    test('defaults createdSessionsStats to zeroed values when missing', () {
      final model = SessionStatisticsModel.fromJson(const {
        'totalSessionsJoined': 0,
        'totalSessionsCreated': 0,
        'upcomingSessions': 0,
        'pastSessions': 0,
        'confirmedSessions': 0,
      });

      expect(model.createdSessionsStats.total, 0);
      expect(model.sessionTypeBreakdown, isEmpty);
    });
  });

  group('InviteAnalyticsModel', () {
    test('parses nested "analytics" key including per-day breakdown', () {
      final model = InviteAnalyticsModel.fromJson(const {
        'analytics': {
          'totalInvites': 20,
          'accepted': 15,
          'rejected': 2,
          'pending': 3,
          'acceptanceRate': 0.75,
          'uniqueRecipientsCount': 18,
          'avgTimeToAccept': 3600000,
          'invitesSentPerDay': [
            {'date': '2026-05-01', 'count': 5},
            {'date': '2026-05-02', 'count': 15},
          ],
          'topInvitedDomains': ['gmail.com', 'yahoo.com'],
        },
      });

      expect(model.totalInvites, 20);
      expect(model.acceptanceRate, 0.75);
      expect(model.invitesSentPerDay, hasLength(2));
      expect(model.invitesSentPerDay.first.date, '2026-05-01');
      expect(model.topInvitedDomains, ['gmail.com', 'yahoo.com']);
    });

    test('reads fields from the top level when no "analytics" wrapper is present', () {
      final model = InviteAnalyticsModel.fromJson(const {
        'totalInvites': 5,
        'accepted': 5,
        'rejected': 0,
        'pending': 0,
        'acceptanceRate': 1.0,
        'uniqueRecipientsCount': 5,
      });

      expect(model.totalInvites, 5);
      expect(model.invitesSentPerDay, isEmpty);
      expect(model.topInvitedDomains, isEmpty);
    });
  });

  group('NearbyGroupModel', () {
    test('parses creator and _count fields', () {
      final model = NearbyGroupModel.fromJson(const {
        'id': 'g1',
        'name': 'Sunday League',
        'distance': 2.5,
        'isPublic': true,
        'creator': {'name': 'Alex', 'profilePicture': 'pic.jpg'},
        '_count': {'members': 12, 'events': 4},
      });

      expect(model.creatorName, 'Alex');
      expect(model.memberCount, 12);
      expect(model.sessionCount, 4);
    });
  });
}
