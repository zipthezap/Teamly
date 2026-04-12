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

  // Debounce timer for address search
  DateTime _lastAddressSearch = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    final mapsKey = ref.read(appConfigProvider).googleMapsApiKey;
    _geocoding = GeocodingUtils(googleMapsApiKey: mapsKey);
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
    final panelBg = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
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
          // ── Search panel ────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            decoration: BoxDecoration(
              color: panelBg,
              border: Border(bottom: BorderSide(color: panelBorder)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Location search field + GPS button
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _locationCtrl,
                        onChanged: _searchAddress,
                        decoration: InputDecoration(
                          labelText: 'Location',
                          hintText: 'Search address or city…',
                          prefixIcon: const Icon(Icons.location_on_outlined, size: 18),
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(
                              vertical: 10, horizontal: 12),
                          labelStyle: TextStyle(color: secondaryText, fontSize: 13),
                          suffixIcon: _searchingAddress
                              ? const Padding(
                                  padding: EdgeInsets.all(12),
                                  child: SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  ),
                                )
                              : null,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // GPS button
                    _gettingLocation
                        ? const SizedBox(
                            width: 40,
                            height: 40,
                            child: Center(
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            ),
                          )
                        : IconButton(
                            onPressed: _useCurrentLocation,
                            icon: const Icon(Icons.my_location_rounded),
                            tooltip: 'Use current location',
                            color: AppThemeTokens.primary400,
                          ),
                  ],
                ),
                // Address suggestions dropdown
                if (_suggestions.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      color: isDark ? AppThemeTokens.darkCardElevated : AppThemeTokens.lightCard,
                      borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
                      border: Border.all(color: panelBorder),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.15),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: _suggestions.length,
                      separatorBuilder: (_, __) =>
                          Divider(height: 1, color: panelBorder),
                      itemBuilder: (_, i) {
                        final s = _suggestions[i];
                        return InkWell(
                          onTap: () => _selectSuggestion(s),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                            child: Row(
                              children: [
                                Icon(Icons.place_outlined,
                                    size: 16, color: secondaryText),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    s.displayName,
                                    style: TextStyle(
                                        fontSize: 13, color: mainText),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                if (_geocodeError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      _geocodeError!,
                      style: const TextStyle(
                          color: AppThemeTokens.error, fontSize: 11),
                    ),
                  ),
                const SizedBox(height: 10),
                // Radius slider + Search button
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Radius: ${_radius.toStringAsFixed(0)} km',
                            style: TextStyle(color: secondaryText, fontSize: 12),
                          ),
                          Slider(
                            value: _radius,
                            min: 5,
                            max: 100,
                            divisions: 19,
                            activeColor: AppThemeTokens.primary500,
                            onChanged: (v) => setState(() => _radius = v),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    UiPrimaryButton(
                      text: 'Search',
                      onPressed: (_loading || _lat == null) ? null : _search,
                      icon: Icons.search,
                      fullWidth: false,
                    ),
                  ],
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      _error!,
                      style: const TextStyle(
                          color: AppThemeTokens.error, fontSize: 12),
                    ),
                  ),
              ],
            ),
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
