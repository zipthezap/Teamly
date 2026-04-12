import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AppConfig {
  const AppConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.googleClientId,
    required this.googleMapsApiKey,
  });

  final String environment;
  final String apiBaseUrl;

  /// The OAuth 2.0 **web** client ID registered in Google Cloud Console.
  ///
  /// This is the same `GOOGLE_CLIENT_ID` used by the backend to verify Google
  /// ID tokens.  Pass it as a dart-define at build time:
  ///
  ///   flutter run --dart-define=GOOGLE_CLIENT_ID=<your-web-client-id>
  ///
  /// Without this value, `GoogleSignIn.authentication.idToken` will be `null`
  /// on Android and Google sign-in will fail.
  final String googleClientId;

  /// Google Maps / Places API key used for address geocoding in the nearby
  /// features.  Pass it as a dart-define at build time:
  ///
  ///   flutter run --dart-define=GOOGLE_MAPS_API_KEY=<your-api-key>
  ///
  /// When empty the nearby pages fall back to the OpenStreetMap Nominatim API.
  final String googleMapsApiKey;

  factory AppConfig.fromDefines() {
    const env = String.fromEnvironment('APP_ENV', defaultValue: 'dev');
    const apiBaseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:3000/api',
    );
    // Web OAuth client ID – shared with the backend GOOGLE_CLIENT_ID env var.
    // When not provided the field is empty and serverClientId will be null,
    // which means GoogleSignIn will not request an idToken on Android and
    // the Google sign-in button will return an error at runtime.
    const googleClientId = String.fromEnvironment('GOOGLE_CLIENT_ID', defaultValue: '');

    // Google Maps API key for geocoding. When empty the app falls back to
    // the OpenStreetMap Nominatim geocoding service.
    const googleMapsApiKey = String.fromEnvironment('GOOGLE_MAPS_API_KEY', defaultValue: '');

    final resolvedApiBaseUrl = _resolveApiBaseUrl(apiBaseUrl);

    return AppConfig(
      environment: env,
      apiBaseUrl: resolvedApiBaseUrl,
      googleClientId: googleClientId,
      googleMapsApiKey: googleMapsApiKey,
    );
  }

  static String _resolveApiBaseUrl(String rawUrl) {
    if (kIsWeb) return rawUrl;
    if (defaultTargetPlatform != TargetPlatform.windows) return rawUrl;

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
