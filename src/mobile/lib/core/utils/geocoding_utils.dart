import 'package:dio/dio.dart';

/// A single place suggestion returned by the geocoding service.
class PlaceSuggestion {
  const PlaceSuggestion({
    required this.displayName,
    required this.lat,
    required this.lng,
  });

  final String displayName;
  final double lat;
  final double lng;
}

/// Lightweight geocoding helper that wraps either the Google Geocoding API or
/// the OpenStreetMap Nominatim API.
///
/// When [googleMapsApiKey] is a non-empty string the Google Geocoding REST API
/// is used (`https://maps.googleapis.com/maps/api/geocode/json`).  Otherwise
/// the free Nominatim service is used as a fallback so that the app still
/// works without a Maps API key during development.
class GeocodingUtils {
  GeocodingUtils({required this.googleMapsApiKey, Dio? dio})
      : _dio = dio ?? Dio();

  final String googleMapsApiKey;
  final Dio _dio;

  bool get _hasGoogleKey => googleMapsApiKey.isNotEmpty;

  /// Search for up to [limit] place suggestions matching [query].
  ///
  /// Returns an empty list when the query is too short or the service fails.
  Future<List<PlaceSuggestion>> search(
    String query, {
    int limit = 5,
  }) async {
    if (_hasGoogleKey) {
      return _searchGoogle(query, limit: limit);
    }
    return _searchNominatim(query, limit: limit);
  }

  Future<List<PlaceSuggestion>> _searchGoogle(
    String query, {
    required int limit,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      'https://maps.googleapis.com/maps/api/geocode/json',
      queryParameters: {
        'address': query,
        'key': googleMapsApiKey,
      },
      options: Options(
        sendTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
      ),
    );
    final data = response.data ?? {};
    final results = data['results'] as List<dynamic>? ?? [];
    return results.take(limit).map((e) {
      final m = e as Map<String, dynamic>;
      final geometry = m['geometry'] as Map<String, dynamic>? ?? {};
      final location = geometry['location'] as Map<String, dynamic>? ?? {};
      return PlaceSuggestion(
        displayName: m['formatted_address'] as String? ?? '',
        lat: (location['lat'] as num?)?.toDouble() ?? 0,
        lng: (location['lng'] as num?)?.toDouble() ?? 0,
      );
    }).toList();
  }

  Future<List<PlaceSuggestion>> _searchNominatim(
    String query, {
    required int limit,
  }) async {
    final response = await _dio.get<List<dynamic>>(
      'https://nominatim.openstreetmap.org/search',
      queryParameters: {
        'q': query,
        'format': 'json',
        'limit': '$limit',
        'addressdetails': '1',
      },
      options: Options(
        headers: {'User-Agent': 'TeamlyMobileApp/1.0'},
        sendTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
      ),
    );
    final items = response.data ?? [];
    return items.map((e) {
      final m = e as Map<String, dynamic>;
      return PlaceSuggestion(
        displayName: m['display_name'] as String? ?? '',
        lat: double.tryParse(m['lat'] as String? ?? '') ?? 0,
        lng: double.tryParse(m['lon'] as String? ?? '') ?? 0,
      );
    }).toList();
  }

  void close() {
    _dio.close();
  }
}
