import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/geocoding_utils.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/location_search_form.dart';

final _publicTournamentsProvider = FutureProvider.family<List<TournamentModel>,
    ({double latitude, double longitude, double radius})?>((ref, location) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get<dynamic>(
    '/api/tournaments/public',
    queryParameters: location == null
        ? null
        : {
            'latitude': location.latitude.toString(),
            'longitude': location.longitude.toString(),
            'radius': location.radius.toStringAsFixed(0),
            'limit': '100',
          },
  );
  final data = response.data as Map<String, dynamic>;
  final list = data['data'] as List<dynamic>? ?? [];
  return list
      .whereType<Map<String, dynamic>>()
      .map(TournamentModel.fromJson)
      .toList();
});

class PublicTournamentsPage extends ConsumerStatefulWidget {
  const PublicTournamentsPage({super.key});

  @override
  ConsumerState<PublicTournamentsPage> createState() => _PublicTournamentsPageState();
}

class _PublicTournamentsPageState extends ConsumerState<PublicTournamentsPage> {
  String _search = '';
  String? _sportFilter;
  String? _statusFilter;
  final _locationCtrl = TextEditingController();
  double? _selectedLat;
  double? _selectedLng;
  double? _queryLat;
  double? _queryLng;
  double _radius = 25;
  String? _locationError;
  String? _geocodeError;
  bool _searchingAddress = false;
  bool _gettingLocation = false;
  List<PlaceSuggestion> _suggestions = [];
  DateTime _lastAddressSearch = DateTime.fromMillisecondsSinceEpoch(0);
  late final GeocodingUtils _geocoding;
  bool _geocodingInitialized = false;

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
      if (!mounted) return;
      setState(() => _suggestions = suggestions);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _suggestions = [];
        _geocodeError = 'Could not search addresses. Check your connection.';
      });
    } finally {
      if (mounted) setState(() => _searchingAddress = false);
    }
  }

  void _selectSuggestion(PlaceSuggestion suggestion) {
    setState(() {
      _selectedLat = suggestion.lat;
      _selectedLng = suggestion.lng;
      _locationCtrl.text = suggestion.displayName;
      _suggestions = [];
      _locationError = null;
    });
    FocusScope.of(context).unfocus();
    _applyLocationSearch();
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _gettingLocation = true;
      _locationError = null;
    });
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _locationError =
              'Location services are disabled. Please enable them in settings.';
        });
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() => _locationError = 'Location permission denied.');
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _locationError =
              'Location permission permanently denied. Please enable in settings.';
        });
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.medium),
      );
      setState(() {
        _selectedLat = pos.latitude;
        _selectedLng = pos.longitude;
        _locationCtrl.text =
            '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}';
        _suggestions = [];
      });
      _applyLocationSearch();
    } catch (e) {
      if (!mounted) return;
      setState(() => _locationError = 'Failed to get location: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _gettingLocation = false);
    }
  }

  void _applyLocationSearch() {
    if (_selectedLat == null || _selectedLng == null) {
      setState(() => _locationError = 'Please select a location first');
      return;
    }
    setState(() {
      _queryLat = _selectedLat;
      _queryLng = _selectedLng;
      _locationError = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final locationFilter = _queryLat != null && _queryLng != null
        ? (
            latitude: _queryLat!,
            longitude: _queryLng!,
            radius: _radius,
          )
        : null;
    final async = ref.watch(_publicTournamentsProvider(locationFilter));

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Discover Tournaments'),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: Column(
        children: [
          LocationSearchForm(
            locationCtrl: _locationCtrl,
            radius: _radius,
            loading: async.isLoading,
            gettingLocation: _gettingLocation,
            searchingAddress: _searchingAddress,
            suggestions: _suggestions,
            error: _locationError,
            geocodeError: _geocodeError,
            onAddressChanged: _searchAddress,
            onSuggestionSelected: _selectSuggestion,
            onRadiusChanged: (value) {
              setState(() => _radius = value);
              if (_queryLat != null && _queryLng != null) {
                _applyLocationSearch();
              }
            },
            onSearch: (_selectedLat != null && _selectedLng != null)
                ? _applyLocationSearch
                : null,
            onUseCurrentLocation: _useCurrentLocation,
          ),
          _FilterBar(
            search: _search,
            sport: _sportFilter,
            status: _statusFilter,
            onSearchChanged: (v) => setState(() => _search = v),
            onSportChanged: (v) => setState(() => _sportFilter = v),
            onStatusChanged: (v) => setState(() => _statusFilter = v),
          ),
          Expanded(
            child: async.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorDisplay(message: e.toString()),
              data: (tournaments) {
                final filtered = _applyFilters(tournaments);
                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.search_off,
                            size: 64, color: AppThemeTokens.textMuted(context)),
                        const SizedBox(height: 16),
                        Text(
                          'No tournaments found',
                          style: TextStyle(
                              color: AppThemeTokens.textSecondary(context)),
                        ),
                      ],
                    ),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) => _TournamentCard(
                    tournament: filtered[i],
                    onTap: () => context.push('/tournaments/${filtered[i].id}'),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<TournamentModel> _applyFilters(List<TournamentModel> list) {
    return list.where((t) {
      final matchesSearch = _search.isEmpty ||
          t.name.toLowerCase().contains(_search.toLowerCase()) ||
          (t.location?.toLowerCase().contains(_search.toLowerCase()) ?? false);
      final matchesSport = _sportFilter == null || t.sportType == _sportFilter;
      final matchesStatus = _statusFilter == null || t.status == _statusFilter;
      return matchesSearch && matchesSport && matchesStatus;
    }).toList();
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.search,
    required this.sport,
    required this.status,
    required this.onSearchChanged,
    required this.onSportChanged,
    required this.onStatusChanged,
  });

  final String search;
  final String? sport;
  final String? status;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String?> onSportChanged;
  final ValueChanged<String?> onStatusChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Column(
        children: [
          TextField(
            decoration: InputDecoration(
              hintText: 'Search tournaments…',
              prefixIcon: const Icon(Icons.search, size: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                borderSide: BorderSide(color: AppThemeTokens.border(context)),
              ),
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
            ),
            onChanged: onSearchChanged,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: sport,
                  hint: const Text('Sport', style: TextStyle(fontSize: 13)),
                  decoration: InputDecoration(
                    isDense: true,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                    ),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('All sports')),
                    ...['soccer', 'basketball', 'volleyball', 'tennis', 'cricket',
                            'baseball', 'other']
                        .map((s) => DropdownMenuItem(
                              value: s,
                              child: Text(s[0].toUpperCase() + s.substring(1)),
                            )),
                  ],
                  onChanged: onSportChanged,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: status,
                  hint: const Text('Status', style: TextStyle(fontSize: 13)),
                  decoration: InputDecoration(
                    isDense: true,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                    ),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  items: const [
                    DropdownMenuItem(value: null, child: Text('All statuses')),
                    DropdownMenuItem(value: 'registration', child: Text('Registration')),
                    DropdownMenuItem(value: 'in_progress', child: Text('In Progress')),
                    DropdownMenuItem(value: 'draft', child: Text('Draft')),
                    DropdownMenuItem(value: 'completed', child: Text('Completed')),
                  ],
                  onChanged: onStatusChanged,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TournamentCard extends StatelessWidget {
  const _TournamentCard({required this.tournament, required this.onTap});

  final TournamentModel tournament;
  final VoidCallback onTap;

  Color _statusColor() {
    switch (tournament.status) {
      case 'registration':
        return AppThemeTokens.info;
      case 'in_progress':
        return AppThemeTokens.success;
      case 'completed':
        return AppThemeTokens.warning;
      default:
        return AppThemeTokens.primary500;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: Container(
        decoration: BoxDecoration(
          color: AppThemeTokens.cardElevated(context),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.border(context)),
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    tournament.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 15),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusColor().withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    tournament.status,
                    style: TextStyle(
                      color: _statusColor(),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.sports, size: 14, color: AppThemeTokens.textMuted(context)),
                const SizedBox(width: 4),
                Text(
                  tournament.sportType,
                  style: TextStyle(
                      fontSize: 12, color: AppThemeTokens.textSecondary(context)),
                ),
                if (tournament.location != null) ...[
                  const SizedBox(width: 12),
                  Icon(Icons.location_on_outlined,
                      size: 14, color: AppThemeTokens.textMuted(context)),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      tournament.location!,
                      style: TextStyle(
                          fontSize: 12,
                          color: AppThemeTokens.textSecondary(context)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.people_outline,
                    size: 14, color: AppThemeTokens.textMuted(context)),
                const SizedBox(width: 4),
                Text(
                  '${tournament.teamCount} team${tournament.teamCount == 1 ? '' : 's'}',
                  style: TextStyle(
                      fontSize: 12, color: AppThemeTokens.textMuted(context)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
