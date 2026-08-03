import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/core/models/chat_model.dart';

void main() {
  group('ChatMessageModel', () {
    test('parses sender name/id/picture from the nested "sender" key', () {
      final model = ChatMessageModel.fromJson(const {
        'id': 'm1',
        'groupId': 'g1',
        'content': 'Hello team',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'sender': {'id': 'u1', 'name': 'Alex', 'profilePicture': 'pic.jpg'},
      });

      expect(model.senderId, 'u1');
      expect(model.senderName, 'Alex');
      expect(model.senderPicture, 'pic.jpg');
    });

    test('falls back to top-level senderId and defaults name to Unknown', () {
      final model = ChatMessageModel.fromJson(const {
        'id': 'm2',
        'groupId': 'g1',
        'content': 'Legacy message',
        'createdAt': '2026-05-08T10:00:00.000Z',
        'senderId': 'u2',
      });

      expect(model.senderId, 'u2');
      expect(model.senderName, 'Unknown');
      expect(model.senderPicture, isNull);
    });

    test('defaults senderId to empty string when neither key is present', () {
      final model = ChatMessageModel.fromJson(const {
        'id': 'm3',
        'groupId': 'g1',
        'content': 'No sender',
        'createdAt': '2026-05-08T10:00:00.000Z',
      });

      expect(model.senderId, '');
      expect(model.senderName, 'Unknown');
    });
  });
}
