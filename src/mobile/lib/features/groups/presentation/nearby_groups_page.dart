import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/app_exception.dart';
import '../../../core/models/extended_models.dart';
import '../../../shared/widgets/error_display.dart';
import '../data/group_repository_impl.dart';
import '../state/groups_notifier.dart';

// Simple state for the nearby groups search
class _NearbyState {
  _NearbyState({
    this.latitude,
    this.longitude,
    this.radius = 25.0,
    this.results = const [],
    this.loading = false,
    this.error,
  });

  final double? latitude;
  final double? longitude;
  final double radius;
  final List<NearbyGroupModel> results;
  final bool loading;
  final String? error;
}

class NearbyGroupsPage extends ConsumerStatefulWidget {
  const NearbyGroupsPage({super.key});

  @override
  ConsumerState<NearbyGroupsPage> createState() => _NearbyGroupsPageState();
}

class _NearbyGroupsPageState extends ConsumerState<NearbyGroupsPage> {
  final _latCtrl = TextEditingController();
  final _lngCtrl = TextEditingController();
  double _radius = 25.0;
  List<NearbyGroupModel> _results = [];
  bool _loading = false;
  String? _error;
  bool _joining = false;

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
      setState(
          () => _error = 'Please enter valid latitude and longitude values');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final results =
          await ref.read(groupRepositoryProvider).getNearbyGroups(
                latitude: lat,
                longitude: lng,
                radius: _radius,
              );
      setState(() => _results = results);
    } on Exception catch (e) {
      final msg = e is AppException
          ? e.message
          : e.toString().replaceFirst('Exception: ', '');
      setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _requestJoin(NearbyGroupModel group) async {
    setState(() => _joining = true);
    try {
      await ref.read(groupRepositoryProvider).requestJoinGroup(group.id);
      ref.read(groupsNotifierProvider.notifier).load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Join request sent to "${group.name}"')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        final msg = e is AppException
            ? e.message
            : e.toString().replaceFirst('Exception: ', '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
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
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Nearby Groups')),
      body: Column(
        children: [
          // Search form
          Card(
            margin: const EdgeInsets.all(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Search by location',
                      style: theme.textTheme.titleSmall),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _latCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Latitude',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true, signed: true),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _lngCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Longitude',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true, signed: true),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Text(
                          'Radius: ${_radius.toStringAsFixed(0)} km',
                          style: theme.textTheme.bodySmall),
                      Expanded(
                        child: Slider(
                          value: _radius,
                          min: 5,
                          max: 100,
                          divisions: 19,
                          label: '${_radius.toStringAsFixed(0)} km',
                          onChanged: (v) => setState(() => _radius = v),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _loading ? null : _search,
                      icon: _loading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.search),
                      label: const Text('Search'),
                    ),
                  ),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(_error!,
                          style: TextStyle(
                              color: theme.colorScheme.error,
                              fontSize: 12)),
                    ),
                ],
              ),
            ),
          ),

          // Results
          Expanded(
            child: _results.isEmpty
                ? Center(
                    child: Text(
                      'Enter your location to find nearby groups',
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(color: AppThemeTokens.darkTextSecondary),
                      textAlign: TextAlign.center,
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 4),
                    itemCount: _results.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1),
                    itemBuilder: (ctx, i) {
                      final g = _results[i];
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor:
                              theme.colorScheme.primaryContainer,
                          child: Text(
                            g.name.isNotEmpty
                                ? g.name[0].toUpperCase()
                                : '?',
                            style: TextStyle(
                              color:
                                  theme.colorScheme.onPrimaryContainer,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        title: Text(g.name),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (g.sportType != null)
                              Text(g.sportType!,
                                  style: const TextStyle(fontSize: 11)),
                            Row(
                              children: [
                                const Icon(Icons.place_outlined, size: 12),
                                const SizedBox(width: 2),
                                Text(
                                  '${g.distance.toStringAsFixed(1)} km away',
                                  style: const TextStyle(fontSize: 11),
                                ),
                                if (g.memberCount != null) ...[
                                  const SizedBox(width: 8),
                                  const Icon(Icons.people_outline,
                                      size: 12),
                                  const SizedBox(width: 2),
                                  Text('${g.memberCount}',
                                      style: const TextStyle(fontSize: 11)),
                                ],
                              ],
                            ),
                          ],
                        ),
                        isThreeLine: g.sportType != null,
                        trailing: _joining
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2))
                            : OutlinedButton(
                                onPressed: () => context.push('/groups/${g.id}'),
                                child: const Text('View'),
                              ),
                        onTap: () => context.push('/groups/${g.id}'),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
