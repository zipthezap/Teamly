import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/models/extended_models.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../shared/widgets/ui_primitives.dart';
import '../data/event_repository_impl.dart';

class NearbyEventsPage extends ConsumerStatefulWidget {
  const NearbyEventsPage({super.key});

  @override
  ConsumerState<NearbyEventsPage> createState() => _NearbyEventsPageState();
}

class _NearbyEventsPageState extends ConsumerState<NearbyEventsPage> {
  final _latCtrl = TextEditingController();
  final _lngCtrl = TextEditingController();
  double _radius = 25.0;
  List<NearbyEventModel> _results = [];
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
      final results = await ref.read(eventRepositoryProvider).getNearbyEvents(
            latitude: lat,
            longitude: lng,
            radius: _radius,
          );
      setState(() {
        _results = results;
        _loading = false;
      });
    } on Exception catch (e) {
      final msg = e is AppException ? e.message : e.toString();
      setState(() {
        _error = msg;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('MMM d, HH:mm');
    return Scaffold(
      appBar: AppBar(title: const Text('Nearby Events')),
      body: Column(
        children: [
          // Search bar
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            decoration: const BoxDecoration(
              color: AppThemeTokens.darkCard,
              border: Border(
                bottom: BorderSide(color: AppThemeTokens.darkBorder),
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
                            decimal: true, signed: true),
                        decoration: const InputDecoration(
                          labelText: 'Latitude',
                          prefixIcon: Icon(Icons.my_location, size: 18),
                          isDense: true,
                          contentPadding:
                              EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextFormField(
                        controller: _lngCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true, signed: true),
                        decoration: const InputDecoration(
                          labelText: 'Longitude',
                          prefixIcon: Icon(Icons.explore, size: 18),
                          isDense: true,
                          contentPadding:
                              EdgeInsets.symmetric(vertical: 10, horizontal: 12),
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
                            style: const TextStyle(
                              color: AppThemeTokens.darkTextSecondary,
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
                      label: 'Search',
                      onPressed: _loading ? null : _search,
                      icon: Icons.search,
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

          // Results
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
                            horizontal: 14, vertical: 12),
                        itemCount: _results.length,
                        itemBuilder: (ctx, i) {
                          final e = _results[i];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            decoration: BoxDecoration(
                              color: AppThemeTokens.darkCard,
                              borderRadius: BorderRadius.circular(
                                  AppThemeTokens.radiusMd),
                              border: Border.all(
                                  color: AppThemeTokens.darkBorder),
                            ),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(
                                  AppThemeTokens.radiusMd),
                              onTap: () => context.push('/events/${e.id}'),
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
                                          size: 20),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            e.title,
                                            style: const TextStyle(
                                              color: AppThemeTokens.darkText,
                                              fontWeight: FontWeight.w600,
                                              fontSize: 14,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 3),
                                          Row(
                                            children: [
                                              if (e.startTime != null) ...[
                                                const Icon(
                                                    Icons.schedule,
                                                    size: 11,
                                                    color: AppThemeTokens
                                                        .darkTextMuted),
                                                const SizedBox(width: 3),
                                                Text(
                                                  df.format(
                                                      e.startTime!.toLocal()),
                                                  style: const TextStyle(
                                                    color: AppThemeTokens
                                                        .darkTextSecondary,
                                                    fontSize: 11,
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                              ],
                                              if (e.city != null) ...[
                                                const Icon(
                                                    Icons.place,
                                                    size: 11,
                                                    color: AppThemeTokens
                                                        .darkTextMuted),
                                                const SizedBox(width: 3),
                                                Text(
                                                  e.city!,
                                                  style: const TextStyle(
                                                    color: AppThemeTokens
                                                        .darkTextSecondary,
                                                    fontSize: 11,
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                          if (e.sportType != null &&
                                              e.sportType!.isNotEmpty) ...[
                                            const SizedBox(height: 4),
                                            Text(
                                              sportTypeLabel(e.sportType),
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
                                          '${e.distance.toStringAsFixed(1)} km',
                                          style: const TextStyle(
                                            color:
                                                AppThemeTokens.primary400,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        const Icon(Icons.chevron_right,
                                            color:
                                                AppThemeTokens.darkTextMuted,
                                            size: 18),
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
