import 'dart:io';

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

    final resolvedApiBaseUrl = _resolveApiBaseUrl(apiBaseUrl);

    return AppConfig(
      environment: env,
      apiBaseUrl: resolvedApiBaseUrl,
    );
  }

  static String _resolveApiBaseUrl(String rawUrl) {
    if (!Platform.isWindows) return rawUrl;

    final uri = Uri.tryParse(rawUrl);
    if (uri == null || uri.host.toLowerCase() != 'localhost') {
      return rawUrl;
    }

    return uri.replace(host: '127.0.0.1').toString();
  }
}

final appConfigProvider = Provider<AppConfig>((ref) {
  throw UnimplementedError('appConfigProvider must be overridden at bootstrap');
});
