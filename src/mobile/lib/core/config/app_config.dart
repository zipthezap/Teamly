import 'package:flutter_riverpod/flutter_riverpod.dart';

class AppConfig {
  const AppConfig({
    required this.environment,
    required this.apiBaseUrl,
  });

  final String environment;
  final String apiBaseUrl;

  factory AppConfig.fromDefines() {
    const env = String.fromEnvironment('APP_ENV', defaultValue: 'dev');
    const apiBaseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:3000/api',
    );

    return const AppConfig(
      environment: env,
      apiBaseUrl: apiBaseUrl,
    );
  }
}

final appConfigProvider = Provider<AppConfig>((ref) {
  throw UnimplementedError('appConfigProvider must be overridden at bootstrap');
});
