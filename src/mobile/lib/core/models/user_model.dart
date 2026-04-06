import 'package:equatable/equatable.dart';

class UserModel extends Equatable {
  const UserModel({
    required this.id,
    required this.email,
    required this.name,
    this.profilePicture,
    this.city,
    this.country,
    this.emailVerified = false,
  });

  final String id;
  final String email;
  final String name;
  final String? profilePicture;
  final String? city;
  final String? country;
  final bool emailVerified;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      profilePicture: json['profilePicture'] as String?,
      city: json['city'] as String?,
      country: json['country'] as String?,
      emailVerified: (json['emailVerified'] as bool?) ?? false,
    );
  }

  @override
  List<Object?> get props => [id, email, name, profilePicture, city, country, emailVerified];
}
