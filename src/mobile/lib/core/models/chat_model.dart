import 'package:equatable/equatable.dart';

class ChatMessageModel extends Equatable {
  const ChatMessageModel({
    required this.id,
    required this.groupId,
    required this.content,
    required this.createdAt,
    required this.senderId,
    required this.senderName,
    this.senderPicture,
  });

  final String id;
  final String groupId;
  final String content;
  final DateTime createdAt;
  final String senderId;
  final String senderName;
  final String? senderPicture;

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    final sender = json['sender'] as Map<String, dynamic>?;
    return ChatMessageModel(
      id: json['id'] as String,
      groupId: json['groupId'] as String,
      content: json['content'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      senderId: sender?['id'] as String? ?? json['senderId'] as String? ?? '',
      senderName: sender?['name'] as String? ?? 'Unknown',
      senderPicture: sender?['profilePicture'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, groupId, content, createdAt, senderId];
}
