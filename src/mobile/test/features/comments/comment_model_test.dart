import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/comment_model.dart';

void main() {
  group('CommentModel', () {
    test('parses nested user name/picture and falls back to top-level userId', () {
      final model = CommentModel.fromJson(const {
        'id': 'c1',
        'eventId': 'e1',
        'userId': 'u1',
        'content': 'Nice session!',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'updatedAt': '2026-05-08T10:00:00.000Z',
        'user': {'id': 'u1', 'name': 'Alex', 'profilePicture': 'pic.jpg'},
      });

      expect(model.userId, 'u1');
      expect(model.userName, 'Alex');
      expect(model.userPicture, 'pic.jpg');
    });

    test('falls back to legacy sessionId key when eventId is absent', () {
      final model = CommentModel.fromJson(const {
        'id': 'c2',
        'sessionId': 'e2',
        'userId': 'u2',
        'userName': 'Jamie',
        'content': 'Legacy comment',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'updatedAt': '2026-05-08T10:00:00.000Z',
      });

      expect(model.eventId, 'e2');
      expect(model.userName, 'Jamie');
      expect(model.userPicture, isNull);
    });

    test('toJson round-trips the required fields', () {
      final model = CommentModel.fromJson(const {
        'id': 'c3',
        'eventId': 'e3',
        'userId': 'u3',
        'userName': 'Sam',
        'content': 'Round trip',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'updatedAt': '2026-05-08T11:00:00.000Z',
      });

      final json = model.toJson();

      expect(json['id'], 'c3');
      expect(json['eventId'], 'e3');
      expect(json['content'], 'Round trip');
      expect(json.containsKey('userPicture'), isFalse);
    });
  });
}
