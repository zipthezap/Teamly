class EventRequestModel {
  const EventRequestModel({
    required this.id,
    required this.groupId,
    required this.title,
    this.description,
    this.requestedDate,
    this.sportType,
    required this.status,
    required this.createdById,
    this.createdByName,
    required this.voteCount,
    required this.totalVotes,
    required this.createdAt,
  });

  final String id;
  final String groupId;
  final String title;
  final String? description;
  final DateTime? requestedDate;
  final String? sportType;
  final String status;
  final String createdById;
  final String? createdByName;
  final int voteCount;
  final int totalVotes;
  final DateTime createdAt;

  factory EventRequestModel.fromJson(Map<String, dynamic> json) {
    final creator = json['createdBy'] as Map<String, dynamic>?;
    return EventRequestModel(
      id: json['id'] as String,
      groupId: json['groupId'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      requestedDate: json['requestedDate'] != null
          ? DateTime.parse(json['requestedDate'] as String)
          : null,
      sportType: json['sportType'] as String?,
      status: json['status'] as String? ?? 'pending',
      createdById:
          creator?['id'] as String? ?? json['createdById'] as String? ?? '',
      createdByName:
          creator?['name'] as String? ?? json['createdByName'] as String?,
      voteCount: (json['voteCount'] as num?)?.toInt() ?? 0,
      totalVotes: (json['totalVotes'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class VoteModel {
  const VoteModel({
    required this.id,
    required this.userId,
    required this.vote,
  });

  final String id;
  final String userId;
  final bool vote;

  factory VoteModel.fromJson(Map<String, dynamic> json) {
    return VoteModel(
      id: json['id'] as String,
      userId: json['userId'] as String,
      vote: (json['vote'] as bool?) ?? true,
    );
  }
}
