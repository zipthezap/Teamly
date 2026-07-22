import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/group_model.dart';

void main() {
  group('GroupModel', () {
    Map<String, dynamic> baseJson() => {
          'id': 'g1',
          'name': 'Sunday League',
          'isPublic': true,
          'createdAt': '2026-01-01T00:00:00.000Z',
        };

    test('parses required fields and defaults', () {
      final model = GroupModel.fromJson(baseJson());

      expect(model.id, 'g1');
      expect(model.autoApproveJoinRequests, isFalse);
      expect(model.allowMemberInvites, isTrue);
      expect(model.allowMemberCopyLink, isTrue);
      expect(model.members, isEmpty);
      expect(model.memberCount, 0);
    });

    test('parses members and prefers _count for memberCount', () {
      final json = {
        ...baseJson(),
        'members': [
          {
            'userId': 'u1',
            'role': 'admin',
            'user': {'name': 'Alex', 'email': 'alex@example.com'},
          },
        ],
        '_count': {'members': 5, 'sessions': 2},
      };

      final model = GroupModel.fromJson(json);

      expect(model.members, hasLength(1));
      expect(model.members.first.name, 'Alex');
      expect(model.members.first.role, 'admin');
      // _count.members takes precedence over members.length.
      expect(model.memberCount, 5);
    });

    test('memberCount falls back to members.length without _count', () {
      final json = {
        ...baseJson(),
        'members': [
          {'userId': 'u1', 'role': 'member'},
          {'userId': 'u2', 'role': 'member'},
        ],
      };

      final model = GroupModel.fromJson(json);

      expect(model.memberCount, 2);
    });
  });

  group('GroupMemberModel', () {
    test('falls back from top-level fields to nested user fields', () {
      final model = GroupMemberModel.fromJson(const {
        'userId': 'u1',
        'role': 'member',
        'user': {
          'id': 'u1',
          'name': 'Jamie',
          'email': 'jamie@example.com',
          'profilePicture': 'pic.jpg',
        },
      });

      expect(model.id, 'u1');
      expect(model.name, 'Jamie');
      expect(model.email, 'jamie@example.com');
      expect(model.profilePicture, 'pic.jpg');
    });

    test('defaults name to Unknown and role to member when missing', () {
      final model = GroupMemberModel.fromJson(const {'userId': 'u2'});

      expect(model.name, 'Unknown');
      expect(model.role, 'member');
      expect(model.email, '');
    });

    test('treats the literal string "null" as absent', () {
      final model = GroupMemberModel.fromJson(const {
        'userId': 'u3',
        'name': 'null',
        'email': 'null',
      });

      expect(model.name, 'Unknown');
      expect(model.email, '');
    });
  });
}
