import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/config/app_config.dart';
import '../../../core/error/error_utils.dart';
import '../../../core/models/extended_models.dart';
import '../../../core/utils/geocoding_utils.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../data/group_repository_impl.dart';
import '../state/groups_notifier.dart';

class NearbyGroupsPage extends ConsumerStatefulWidget {
  const NearbyGroupsPage({super.key});

  @override
  ConsumerState<NearbyGroupsPage> createState() => _NearbyGroupsPageState();
}

class _NearbyGroupsPageState extends ConsumerState<NearbyGroupsPage> {
  final _locationCtrl = TextEditingController();
  double? _lat;
  double? _lng;
  double _radius = 25.0;
  List<NearbyGroupModel> _results = [];
  bool _loading = false;
  String? _error;
  bool _joining = false;

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
        _locationCtrl.text = '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}';
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
    // Debounce: ignore calls within 400ms of each other
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
      if (mounted) {
        setState(() => _suggestions = suggestions);
      }
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
      final results = await ref.read(groupRepositoryProvider).getNearbyGroups(
            latitude: _lat!,
            longitude: _lng!,
            radius: _radius,
          );
      setState(() => _results = results);
    } on Exception catch (e) {
      setState(() => _error = extractErrorMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _requestJoin(NearbyGroupModel group) async {
    setState(() => _joining = true);
    try {
      await ref.read(groupRepositoryProvider).requestJoinGroup(group.id);
      ref.read(groupsNotifierProvider.notifier).reload();
      ref.invalidate(myJoinRequestsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Join request sent to "${group.name}"')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(extractErrorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nearby Groups'),
        actions: [
          IconButton(
            icon: const Icon(Icons.mail_outline_rounded),
            tooltip: 'My Requests & Invites',
            onPressed: () => context.push('/groups/my-requests'),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: Theme.of(context).dividerColor),
        ),
      ),
      body: Column(
        children: [
          _LocationSearchForm(
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
          Expanded(
            child: _results.isEmpty
                ? UiEmptyState(
                    icon: Icons.location_on_outlined,
                    title: 'Find groups near you',
                    message: 'Use your current location or search an address\nto discover nearby groups.',
                  )
                : Builder(builder: (ctx) {
                    final myGroupIds = ref
                        .watch(groupsNotifierProvider)
                        .maybeWhen(
                          data: (list) => list.map((g) => g.id).toSet(),
                          orElse: () => <String>{},
                        );
                    final visible = _results
                        .where((g) => !myGroupIds.contains(g.id))
                        .toList();
                    if (visible.isEmpty) {
                      return const UiEmptyState(
                        icon: Icons.location_on_outlined,
                        title: 'No groups found',
                        message: 'No new groups to join in this area.',
                      );
                    }
                    return ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      itemCount: visible.length,
                      itemBuilder: (ctx, i) {
                        final g = visible[i];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _NearbyGroupCard(
                            group: g,
                            joining: _joining,
                            onView: () => ctx.push('/groups/${g.id}'),
                            onJoin: () => _requestJoin(g),
                          ),
                        );
                      },
                    );
                  }),
          ),
        ],
      ),
    );
  }
}

// ── Location search form ──────────────────────────────────────────────────────

class _LocationSearchForm extends StatelessWidget {
  const _LocationSearchForm({
    required this.locationCtrl,
    required this.radius,
    required this.loading,
    required this.gettingLocation,
    required this.searchingAddress,
    required this.suggestions,
    required this.error,
    required this.geocodeError,
    required this.onAddressChanged,
    required this.onSuggestionSelected,
    required this.onRadiusChanged,
    required this.onSearch,
    required this.onUseCurrentLocation,
  });

  final TextEditingController locationCtrl;
  final double radius;
  final bool loading;
  final bool gettingLocation;
  final bool searchingAddress;
  final List<PlaceSuggestion> suggestions;
  final String? error;
  final String? geocodeError;
  final ValueChanged<String> onAddressChanged;
  final ValueChanged<PlaceSuggestion> onSuggestionSelected;
  final ValueChanged<double> onRadiusChanged;
  final VoidCallback? onSearch;
  final VoidCallback onUseCurrentLocation;

  InputDecoration _fieldDecor(String label, bool isDark) => InputDecoration(
        labelText: label,
        labelStyle: TextStyle(
            color: isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary,
            fontSize: 13),
        filled: true,
        fillColor: isDark ? AppThemeTokens.darkBg : AppThemeTokens.lightBg,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
          borderSide: BorderSide(color: isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
          borderSide: BorderSide(color: isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
          borderSide: const BorderSide(color: AppThemeTokens.primary500),
        ),
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      );

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mainText = isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText;
    final secondaryText = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;
    final bannerGradient = isDark ? AppThemeTokens.heroGradient : AppThemeTokens.lightHeroGradient;
    final bannerBorderColor = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final suggestionBg = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
    final sliderInactiveTrack = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;

    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: bannerGradient,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusLg),
        border: Border.all(color: bannerBorderColor),
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: AppThemeTokens.primary500.withValues(alpha: 0.15),
                  borderRadius:
                      BorderRadius.circular(AppThemeTokens.radiusSm),
                ),
                child: const Icon(Icons.my_location_rounded,
                    size: 16, color: AppThemeTokens.primary400),
              ),
              const SizedBox(width: 10),
              Text(
                'Search by location',
                style: TextStyle(
                  color: mainText,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Address search field
          TextField(
            controller: locationCtrl,
            style: TextStyle(color: mainText, fontSize: 14),
            decoration: _fieldDecor('Search address or city…', isDark).copyWith(
              suffixIcon: searchingAddress
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : locationCtrl.text.isNotEmpty
                      ? IconButton(
                          icon: Icon(Icons.clear_rounded,
                              size: 16,
                              color: secondaryText),
                          onPressed: () => locationCtrl.clear(),
                        )
                      : null,
            ),
            onChanged: onAddressChanged,
          ),
          // Suggestions dropdown
          if (suggestions.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 4),
              decoration: BoxDecoration(
                color: suggestionBg,
                borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
                border: Border.all(color: bannerBorderColor),
              ),
              child: Column(
                children: suggestions.map((s) {
                  return InkWell(
                    onTap: () => onSuggestionSelected(s),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      child: Row(
                        children: [
                          Icon(Icons.place_outlined,
                              size: 14,
                              color: secondaryText),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              s.displayName,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                color: mainText,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          if (geocodeError != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.warning_amber_rounded,
                    size: 13, color: AppThemeTokens.warning),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    geocodeError!,
                    style: const TextStyle(
                      color: AppThemeTokens.warning,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          // "Use my location" button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: gettingLocation ? null : onUseCurrentLocation,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppThemeTokens.primary400,
                side: const BorderSide(color: AppThemeTokens.primary500),
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(AppThemeTokens.radiusSm),
                ),
              ),
              icon: gettingLocation
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.gps_fixed_rounded, size: 16),
              label: Text(
                gettingLocation ? 'Getting location…' : 'Use my current location',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Icon(Icons.radar_rounded,
                  size: 14, color: secondaryText),
              const SizedBox(width: 6),
              Text(
                'Radius: ${radius.toStringAsFixed(0)} km',
                style: TextStyle(
                  fontSize: 12,
                  color: secondaryText,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Expanded(
                child: SliderTheme(
                  data: SliderThemeData(
                    activeTrackColor: AppThemeTokens.primary500,
                    inactiveTrackColor: sliderInactiveTrack,
                    thumbColor: AppThemeTokens.primary400,
                    overlayColor:
                        AppThemeTokens.primary500.withValues(alpha: 0.15),
                    trackHeight: 3,
                  ),
                  child: Slider(
                    value: radius,
                    min: 5,
                    max: 100,
                    divisions: 19,
                    label: '${radius.toStringAsFixed(0)} km',
                    onChanged: onRadiusChanged,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          UiPrimaryButton(
            text: 'Search',
            icon: Icons.search_rounded,
            onPressed: (loading || onSearch == null) ? null : onSearch,
            loading: loading,
          ),
          if (error != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.error_outline_rounded,
                    size: 14, color: AppThemeTokens.error),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    error!,
                    style: const TextStyle(
                      color: AppThemeTokens.error,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ── Nearby group card ─────────────────────────────────────────────────────────

class _NearbyGroupCard extends StatelessWidget {
  const _NearbyGroupCard({
    required this.group,
    required this.joining,
    required this.onView,
    required this.onJoin,
  });

  final NearbyGroupModel group;
  final bool joining;
  final VoidCallback onView;
  final VoidCallback onJoin;

  Color _sportColor() {
    switch (group.sportType?.toLowerCase()) {
      case 'football':
      case 'soccer':
        return const Color(0xFF4CAF50);
      case 'basketball':
        return const Color(0xFFFF9800);
      case 'tennis':
        return const Color(0xFFFFEB3B);
      case 'running':
        return const Color(0xFF00BCD4);
      case 'cycling':
        return const Color(0xFF2196F3);
      case 'volleyball':
        return const Color(0xFF9C27B0);
      default:
        return AppThemeTokens.primary500;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
    final borderColor = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final titleColor = isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText;
    final secondaryColor = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;
    final sportColor = _sportColor();

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: onView,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: Container(
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(color: borderColor),
          ),
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              // Avatar with sport-color ring
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: sportColor.withValues(alpha: 0.45), width: 2),
                ),
                child: UserAvatar(
                  name: group.name,
                  radius: 24,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name + sport pill
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            group.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: titleColor,
                            ),
                          ),
                        ),
                        if (group.sportType != null)
                          Container(
                            margin: const EdgeInsets.only(left: 6),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: sportColor.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(100),
                            ),
                            child: Text(
                              group.sportType!,
                              style: TextStyle(
                                fontSize: 10,
                                color: sportColor,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    // Distance + member count
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppThemeTokens.primary500
                                .withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(100),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.place_outlined,
                                  size: 10,
                                  color: AppThemeTokens.primary400),
                              const SizedBox(width: 3),
                              Text(
                                '${group.distance.toStringAsFixed(1)} km',
                                style: const TextStyle(
                                  fontSize: 10,
                                  color: AppThemeTokens.primary400,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (group.memberCount != null) ...[
                          const SizedBox(width: 8),
                          Icon(Icons.people_outline_rounded,
                              size: 12,
                              color: secondaryColor),
                          const SizedBox(width: 3),
                          Text(
                            '${group.memberCount}',
                            style: TextStyle(
                              fontSize: 12,
                              color: secondaryColor,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // Action buttons
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  joining
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : GestureDetector(
                          onTap: onJoin,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              gradient: AppThemeTokens.primaryGradient,
                              borderRadius: BorderRadius.circular(
                                  AppThemeTokens.radiusSm),
                            ),
                            child: const Text(
                              'Apply',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: onView,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 5),
                      decoration: BoxDecoration(
                        border:
                            Border.all(color: AppThemeTokens.primary500),
                        borderRadius:
                            BorderRadius.circular(AppThemeTokens.radiusSm),
                      ),
                      child: const Text(
                        'View',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppThemeTokens.primary400,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
