class CommentModel {
  const CommentModel({
    required this.id,
    required this.eventId,
    required this.userId,
    required this.userName,
    this.userPicture,
    required this.content,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String eventId;
  final String userId;
  final String userName;
  final String? userPicture;
  final String content;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory CommentModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return CommentModel(
      id: json['id'] as String,
      eventId: (json['eventId'] as String?) ?? (json['sessionId'] as String?) ?? '',
      userId: user?['id'] as String? ?? json['userId'] as String,
      userName: user?['name'] as String? ?? json['userName'] as String? ?? '',
      userPicture: user?['profilePicture'] as String? ??
          json['userPicture'] as String?,
      content: json['content'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'eventId': eventId,
        'userId': userId,
        'userName': userName,
        if (userPicture != null) 'userPicture': userPicture,
        'content': content,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };
}
