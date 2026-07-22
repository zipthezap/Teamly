import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/dashboard_model.dart';

void main() {
  group('DashboardStats', () {
    test('parses upcomingCount from the primary key', () {
      final stats = DashboardStats.fromJson(const {
        'totalSessions': 10,
        'upcomingCount': 3,
        'groupCount': 2,
      });

      expect(stats.upcomingCount, 3);
    });

    test('falls back to upcomingSessions then upcomingEvents', () {
      final fromSessions = DashboardStats.fromJson(const {
        'upcomingSessions': 4,
      });
      expect(fromSessions.upcomingCount, 4);

      final fromEvents = DashboardStats.fromJson(const {
        'upcomingEvents': 5,
      });
      expect(fromEvents.upcomingCount, 5);
    });

    test('defaults all counts to zero when absent', () {
      final stats = DashboardStats.fromJson(const {});

      expect(stats.totalSessions, 0);
      expect(stats.upcomingCount, 0);
      expect(stats.groupCount, 0);
    });
  });

  group('DashboardGroupModel', () {
    test('parses member/event counts from the nested _count map', () {
      final group = DashboardGroupModel.fromJson(const {
        'id': 'g1',
        'name': 'Sunday League',
        'createdAt': '2026-01-01T00:00:00.000Z',
        '_count': {'members': 12, 'sessions': 5},
      });

      expect(group.memberCount, 12);
      expect(group.eventCount, 5);
    });

    test('defaults counts to zero without a _count map', () {
      final group = DashboardGroupModel.fromJson(const {
        'id': 'g1',
        'name': 'Sunday League',
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(group.memberCount, 0);
      expect(group.eventCount, 0);
    });
  });

  group('DashboardUpcomingEventModel', () {
    test('parses startTime, defaults eventType to session, and derives destinationPath', () {
      final event = DashboardUpcomingEventModel.fromJson(const {
        'id': 'e1',
        'title': 'Sunday Match',
        'startTime': '2026-06-01T10:00:00.000Z',
      });

      expect(event.eventType, 'session');
      expect(event.contextName, 'Session');
      expect(event.destinationPath, '/sessions/e1');
    });

    test('derives title/contextName defaults per event type when missing', () {
      final teamup = DashboardUpcomingEventModel.fromJson(const {
        'id': 'tu1',
        'eventType': 'teamup',
        'dateTime': '2026-06-01T10:00:00.000Z',
      });

      expect(teamup.title, 'Untitled TeamUp');
      expect(teamup.contextName, 'TeamUp');
      expect(teamup.destinationPath, '/teamup/tu1');
    });

    test('prefers contextName, then group name, then locationName/city', () {
      final withGroup = DashboardUpcomingEventModel.fromJson(const {
        'id': 'e2',
        'title': 'Match',
        'startDate': '2026-06-01T10:00:00.000Z',
        'group': {'name': 'Sunday League'},
      });
      expect(withGroup.contextName, 'Sunday League');
    });

    test('throws a FormatException when no start time field is present', () {
      expect(
        () => DashboardUpcomingEventModel.fromJson(const {
          'id': 'e3',
          'title': 'Match',
        }),
        throwsFormatException,
      );
    });
  });

  group('DashboardModel', () {
    test('sorts upcoming events by startTime then id, and falls back to zeroed stats', () {
      final model = DashboardModel.fromJson(const {
        'upcomingEvents': [
          {'id': 'e2', 'title': 'Later', 'startTime': '2026-06-02T10:00:00.000Z'},
          {'id': 'e1', 'title': 'Earlier', 'startTime': '2026-06-01T10:00:00.000Z'},
        ],
        'recentGroups': [],
        'unreadNotifications': 2,
      });

      expect(model.upcomingEvents.map((e) => e.id), ['e1', 'e2']);
      expect(model.upcomingSessions, model.upcomingEvents);
      expect(model.unreadNotifications, 2);
      expect(model.stats.totalSessions, 0);
    });

    test('reads upcoming events from the legacy upcomingSessions key', () {
      final model = DashboardModel.fromJson(const {
        'upcomingSessions': [
          {'id': 'e1', 'title': 'Legacy', 'startTime': '2026-06-01T10:00:00.000Z'},
        ],
      });

      expect(model.upcomingEvents, hasLength(1));
      expect(model.upcomingEvents.first.id, 'e1');
    });
  });
}
