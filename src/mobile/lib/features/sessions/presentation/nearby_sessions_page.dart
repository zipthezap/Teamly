import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/error_utils.dart';
import '../../../core/models/extended_models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/session_repository_impl.dart';

class NearbySessionsPage extends ConsumerStatefulWidget {
  const NearbySessionsPage({super.key});

  @override
  ConsumerState<NearbySessionsPage> createState() => _NearbySessionsPageState();
}

class _NearbySessionsPageState extends ConsumerState<NearbySessionsPage> {
  final _latCtrl = TextEditingController();
  final _lngCtrl = TextEditingController();
  double _radius = 25.0;
  List<NearbySessionModel> _results = [];
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _latCtrl.dispose();
    _lngCtrl.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final lat = double.tryParse(_latCtrl.text.trim());
    final lng = double.tryParse(_lngCtrl.text.trim());

    if (lat == null || lng == null) {
      setState(() => _error = 'Please enter valid latitude and longitude');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final results = await ref.read(sessionRepositoryProvider).getNearbyEvents(
            latitude: lat,
            longitude: lng,
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
      appBar: AppBar(title: const Text('Nearby Events')),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            decoration: BoxDecoration(
              color: panelBg,
              border: Border(
                bottom: BorderSide(color: panelBorder),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _latCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                          signed: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Latitude',
                          prefixIcon: Icon(Icons.my_location, size: 18),
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(
                              vertical: 10, horizontal: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextFormField(
                        controller: _lngCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                          signed: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Longitude',
                          prefixIcon: Icon(Icons.explore, size: 18),
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(
                              vertical: 10, horizontal: 12),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Radius: ${_radius.toStringAsFixed(0)} km',
                            style: TextStyle(
                              color: secondaryText,
                              fontSize: 12,
                            ),
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
                      onPressed: _loading ? null : _search,
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
                        color: AppThemeTokens.error,
                        fontSize: 12,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _results.isEmpty
                    ? UiEmptyState(
                        icon: Icons.event_outlined,
                        title: _latCtrl.text.isEmpty
                            ? 'Find events near you'
                            : 'No events found',
                        message: _latCtrl.text.isEmpty
                            ? 'Enter your coordinates and tap Search to find nearby events.'
                            : 'Try increasing the search radius or check a different location.',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        itemCount: _results.length,
                        itemBuilder: (ctx, i) {
                          final event = _results[i];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            decoration: BoxDecoration(
                              color: cardColor,
                              borderRadius: BorderRadius.circular(
                                  AppThemeTokens.radiusMd),
                              border: Border.all(color: panelBorder),
                            ),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(
                                  AppThemeTokens.radiusMd),
                              onTap: () => context.push('/sessions/${event.id}'),
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
                                          AppThemeTokens.radiusSm,
                                        ),
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
                                            event.title,
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
                                              if (event.startTime != null) ...[
                                                Icon(
                                                  Icons.schedule,
                                                  size: 11,
                                                  color: mutedText,
                                                ),
                                                const SizedBox(width: 3),
                                                Text(
                                                  df.format(event.startTime!
                                                      .toLocal()),
                                                  style: TextStyle(
                                                    color: secondaryText,
                                                    fontSize: 11,
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                              ],
                                              if (event.city != null) ...[
                                                Icon(
                                                  Icons.place,
                                                  size: 11,
                                                  color: mutedText,
                                                ),
                                                const SizedBox(width: 3),
                                                Text(
                                                  event.city!,
                                                  style: TextStyle(
                                                    color: secondaryText,
                                                    fontSize: 11,
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                          if (event.sportType != null &&
                                              event.sportType!.isNotEmpty) ...[
                                            const SizedBox(height: 4),
                                            Text(
                                              sportTypeLabel(event.sportType),
                                              style: const TextStyle(
                                                color:
                                                    AppThemeTokens.primary400,
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
                                          '${event.distance.toStringAsFixed(1)} km',
                                          style: const TextStyle(
                                            color: AppThemeTokens.primary400,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        Icon(
                                          Icons.chevron_right,
                                          color: mutedText,
                                          size: 18,
                                        ),
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
