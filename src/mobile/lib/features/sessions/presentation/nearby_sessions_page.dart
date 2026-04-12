import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';

import '../../../core/config/app_config.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/error/error_utils.dart';
import '../../../core/models/extended_models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/geocoding_utils.dart';
import '../../../shared/widgets/location_search_form.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/session_repository_impl.dart';

class NearbySessionsPage extends ConsumerStatefulWidget {
  const NearbySessionsPage({super.key});

  @override
  ConsumerState<NearbySessionsPage> createState() => _NearbySessionsPageState();
}

class _NearbySessionsPageState extends ConsumerState<NearbySessionsPage> {
  final _locationCtrl = TextEditingController();
  double? _lat;
  double? _lng;
  double _radius = 25.0;
  List<NearbySessionModel> _results = [];
  bool _loading = false;
  String? _error;

  // Address autocomplete state
  List<PlaceSuggestion> _suggestions = [];
  bool _searchingAddress = false;
  bool _gettingLocation = false;
  String? _geocodeError;

  // Geocoding helper – uses Google API when key is configured, Nominatim otherwise
  late final GeocodingUtils _geocoding;
  bool _geocodingInitialized = false;

  // Debounce timer for address search
  DateTime _lastAddressSearch = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_geocodingInitialized) {
      final mapsKey = ref.read(appConfigProvider).googleMapsApiKey;
      _geocoding = GeocodingUtils(googleMapsApiKey: mapsKey);
      _geocodingInitialized = true;
    }
  }

  @override
  void dispose() {
    _locationCtrl.dispose();
    _geocoding.close();
    super.dispose();
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _gettingLocation = true;
      _error = null;
    });
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() => _error = 'Location services are disabled. Please enable them in settings.');
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() => _error = 'Location permission denied.');
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        setState(() => _error = 'Location permission permanently denied. Please enable in settings.');
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
      );
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
        _locationCtrl.text =
            '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}';
        _suggestions = [];
      });
      await _search();
    } catch (e) {
      setState(() => _error = 'Failed to get location: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _gettingLocation = false);
    }
  }

  Future<void> _searchAddress(String query) async {
    if (query.length < 3) {
      setState(() => _suggestions = []);
      return;
    }
    final now = DateTime.now();
    _lastAddressSearch = now;
    await Future.delayed(const Duration(milliseconds: 400));
    if (_lastAddressSearch != now || !mounted) return;

    setState(() {
      _searchingAddress = true;
      _geocodeError = null;
    });
    try {
      final suggestions = await _geocoding.search(query);
      if (mounted) setState(() => _suggestions = suggestions);
    } catch (e) {
      if (mounted) {
        setState(() {
          _suggestions = [];
          _geocodeError = 'Could not search addresses. Check your connection.';
        });
      }
    } finally {
      if (mounted) setState(() => _searchingAddress = false);
    }
  }

  void _selectSuggestion(PlaceSuggestion suggestion) {
    setState(() {
      _lat = suggestion.lat;
      _lng = suggestion.lng;
      _locationCtrl.text = suggestion.displayName;
      _suggestions = [];
    });
    FocusScope.of(context).unfocus();
    _search();
  }

  Future<void> _search() async {
    if (_lat == null || _lng == null) {
      setState(() => _error = 'Please select a location first');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final results = await ref.read(sessionRepositoryProvider).getNearbyEvents(
            latitude: _lat!,
            longitude: _lng!,
            radius: _radius,
          );
      setState(() {
        _results = results;
        _loading = false;
      });
    } on Exception catch (e) {
      setState(() {
        _error = extractErrorMessage(e);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final panelBorder = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final secondaryText = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;
    final cardColor = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
    final mainText = isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText;
    final mutedText = isDark ? AppThemeTokens.darkTextMuted : AppThemeTokens.lightTextMuted;

    final df = DateFormat('MMM d, HH:mm');
    return Scaffold(
      appBar: AppBar(title: const Text('Nearby Sessions')),
      body: Column(
        children: [
          LocationSearchForm(
            locationCtrl: _locationCtrl,
            radius: _radius,
            loading: _loading,
            gettingLocation: _gettingLocation,
            searchingAddress: _searchingAddress,
            suggestions: _suggestions,
            error: _error,
            geocodeError: _geocodeError,
            onAddressChanged: _searchAddress,
            onSuggestionSelected: _selectSuggestion,
            onRadiusChanged: (v) => setState(() => _radius = v),
            onSearch: (_lat != null && _lng != null) ? _search : null,
            onUseCurrentLocation: _useCurrentLocation,
          ),
          // ── Results ─────────────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _results.isEmpty
                    ? UiEmptyState(
                        icon: Icons.event_outlined,
                        title: _locationCtrl.text.isEmpty
                            ? 'Find sessions near you'
                            : 'No sessions found',
                        message: _locationCtrl.text.isEmpty
                            ? 'Use your current location or search an address\nto discover nearby sessions.'
                            : 'Try increasing the search radius or check a different location.',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 12),
                        itemCount: _results.length,
                        itemBuilder: (ctx, i) {
                          final session = _results[i];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            decoration: BoxDecoration(
                              color: cardColor,
                              borderRadius:
                                  BorderRadius.circular(AppThemeTokens.radiusMd),
                              border: Border.all(color: panelBorder),
                            ),
                            child: InkWell(
                              borderRadius:
                                  BorderRadius.circular(AppThemeTokens.radiusMd),
                              onTap: () =>
                                  context.push('/sessions/${session.id}'),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 42,
                                      height: 42,
                                      decoration: BoxDecoration(
                                        color: AppThemeTokens.primary500
                                            .withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(
                                            AppThemeTokens.radiusSm),
                                      ),
                                      child: const Icon(
                                        Icons.event_outlined,
                                        color: AppThemeTokens.primary400,
                                        size: 20,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            session.title,
                                            style: TextStyle(
                                              color: mainText,
                                              fontWeight: FontWeight.w600,
                                              fontSize: 14,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 3),
                                          Row(
                                            children: [
                                              if (session.startTime != null) ...[
                                                Icon(Icons.schedule,
                                                    size: 11, color: mutedText),
                                                const SizedBox(width: 3),
                                                Text(
                                                  df.format(session.startTime!
                                                      .toLocal()),
                                                  style: TextStyle(
                                                      color: secondaryText,
                                                      fontSize: 11),
                                                ),
                                                const SizedBox(width: 8),
                                              ],
                                              if (session.city != null) ...[
                                                Icon(Icons.place,
                                                    size: 11, color: mutedText),
                                                const SizedBox(width: 3),
                                                Text(
                                                  session.city!,
                                                  style: TextStyle(
                                                      color: secondaryText,
                                                      fontSize: 11),
                                                ),
                                              ],
                                            ],
                                          ),
                                          if (session.sportType != null &&
                                              session.sportType!.isNotEmpty) ...[
                                            const SizedBox(height: 4),
                                            Text(
                                              sportTypeLabel(session.sportType),
                                              style: const TextStyle(
                                                color: AppThemeTokens.primary400,
                                                fontSize: 11,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '${session.distance.toStringAsFixed(1)} km',
                                          style: const TextStyle(
                                            color: AppThemeTokens.primary400,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        Icon(Icons.chevron_right,
                                            color: mutedText, size: 18),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
