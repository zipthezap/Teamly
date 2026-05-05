import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/tournament_model.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';

final _publicTournamentsProvider = FutureProvider<List<TournamentModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get<dynamic>('/api/tournaments/public');
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

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_publicTournamentsProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Discover Tournaments'),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: Column(
        children: [
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
