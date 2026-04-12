import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/geocoding_utils.dart';
import 'ui_primitives.dart';

/// A reusable location search form with address autocomplete, GPS button,
/// radius slider, and search button. Used by NearbyGroupsPage and
/// NearbySessionsPage.
class LocationSearchForm extends StatelessWidget {
  const LocationSearchForm({
    super.key,
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
            color: isDark
                ? AppThemeTokens.darkTextSecondary
                : AppThemeTokens.lightTextSecondary,
            fontSize: 13),
        filled: true,
        fillColor: isDark ? AppThemeTokens.darkBg : AppThemeTokens.lightBg,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
          borderSide: BorderSide(
              color: isDark
                  ? AppThemeTokens.darkBorder
                  : AppThemeTokens.lightBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
          borderSide: BorderSide(
              color: isDark
                  ? AppThemeTokens.darkBorder
                  : AppThemeTokens.lightBorder),
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
    final secondaryText =
        isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;
    final bannerGradient =
        isDark ? AppThemeTokens.heroGradient : AppThemeTokens.lightHeroGradient;
    final bannerBorderColor =
        isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final suggestionBg =
        isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
    final sliderInactiveTrack =
        isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;

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
                              size: 16, color: secondaryText),
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
                              size: 14, color: secondaryText),
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
              Icon(Icons.radar_rounded, size: 14, color: secondaryText),
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
