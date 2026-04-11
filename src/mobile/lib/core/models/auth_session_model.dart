import 'package:equatable/equatable.dart';

class AuthSessionModel extends Equatable {
  const AuthSessionModel({
    required this.id,
    required this.lastActive,
    required this.createdAt,
    required this.expiresAt,
    this.deviceInfo,
    this.ipAddress,
  });

  final String id;
  final DateTime lastActive;
  final DateTime createdAt;
  final DateTime expiresAt;
  final String? deviceInfo;
  final String? ipAddress;

  factory AuthSessionModel.fromJson(Map<String, dynamic> json) {
    return AuthSessionModel(
      id: json['id'] as String,
      lastActive: DateTime.parse(json['lastActive'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      deviceInfo: json['deviceInfo'] as String?,
      ipAddress: json['ipAddress'] as String?,
    );
  }

  bool get isExpired => expiresAt.isBefore(DateTime.now());

  @override
  List<Object?> get props => [id, lastActive, createdAt, expiresAt];
}
