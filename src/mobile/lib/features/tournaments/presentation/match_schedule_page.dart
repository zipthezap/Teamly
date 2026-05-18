import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../state/tournaments_notifier.dart';

class MatchSchedulePage extends ConsumerStatefulWidget {
  const MatchSchedulePage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  ConsumerState<MatchSchedulePage> createState() => _MatchSchedulePageState();
}

class _MatchSchedulePageState extends ConsumerState<MatchSchedulePage> {
  String? _filterGroup;

  @override
  Widget build(BuildContext context) {
    final tournamentAsync = ref.watch(tournamentDetailProvider(widget.tournamentId));

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Match Schedule'),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: tournamentAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(message: e.toString()),
        data: (tournament) => _ScheduleView(
          tournament: tournament,
          filterGroup: _filterGroup,
          onFilterChanged: (g) => setState(() => _filterGroup = g),
        ),
      ),
    );
  }
}

class _ScheduleView extends StatelessWidget {
  const _ScheduleView({
    required this.tournament,
    required this.filterGroup,
    required this.onFilterChanged,
  });

  final TournamentModel tournament;
  final String? filterGroup;
  final ValueChanged<String?> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    final allMatches = List<TournamentMatchModel>.from(tournament.matches);

    if (allMatches.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.calendar_today_outlined,
                size: 64, color: AppThemeTokens.textMuted(context)),
            const SizedBox(height: 16),
            Text(
              'No matches scheduled yet',
              style: TextStyle(color: AppThemeTokens.textSecondary(context)),
            ),
          ],
        ),
      );
    }

    // Build pool venue lookup
    final poolVenueMap = <String, String>{};
    for (final pool in tournament.pools) {
      if (pool.venue != null) {
        poolVenueMap[pool.name] = pool.venue!;
      }
    }

    // Collect distinct group/pool names
    final groups = allMatches
        .map((m) => m.round)
        .where((r) => r.isNotEmpty && !r.startsWith('Round'))
        .toSet()
        .toList()
      ..sort();
    final hasGroups = groups.isNotEmpty;

    // Filter
    final matches = filterGroup == null
        ? allMatches
        : allMatches.where((m) => m.round == filterGroup).toList();

    // Sort by scheduled time, nulls last
    matches.sort((a, b) {
      if (a.scheduledAt == null && b.scheduledAt == null) return 0;
      if (a.scheduledAt == null) return 1;
      if (b.scheduledAt == null) return -1;
      return a.scheduledAt!.compareTo(b.scheduledAt!);
    });

    return Column(
      children: [
        if (hasGroups)
          _GroupFilterBar(
            groups: groups,
            selected: filterGroup,
            onSelected: onFilterChanged,
          ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: matches.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) => _MatchTile(
              match: matches[i],
              poolVenueMap: poolVenueMap,
            ),
          ),
        ),
      ],
    );
  }
}

class _GroupFilterBar extends StatelessWidget {
  const _GroupFilterBar({
    required this.groups,
    required this.selected,
    required this.onSelected,
  });

  final List<String> groups;
  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          _FilterChip(
            label: 'All',
            selected: selected == null,
            onTap: () => onSelected(null),
          ),
          const SizedBox(width: 8),
          for (final g in groups) ...[
            _FilterChip(
              label: g,
              selected: selected == g,
              onTap: () => onSelected(g),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected
              ? AppThemeTokens.primary500
              : AppThemeTokens.cardElevated(context),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected
                ? AppThemeTokens.primary500
                : AppThemeTokens.border(context),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppThemeTokens.textSecondary(context),
          ),
        ),
      ),
    );
  }
}

class _MatchTile extends StatelessWidget {
  const _MatchTile({required this.match, required this.poolVenueMap});

  final TournamentMatchModel match;
  final Map<String, String> poolVenueMap;

  String _statusLabel(String status) {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'Live';
      case 'scheduled':
        return 'Scheduled';
      default:
        return 'Pending';
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'completed':
        return AppThemeTokens.success;
      case 'in_progress':
        return AppThemeTokens.error;
      case 'scheduled':
        return AppThemeTokens.info;
      default:
        return AppThemeTokens.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = match.status;
    final isCompleted = status == 'completed';
    final fmt = DateFormat('MMM d, h:mm a');

    // Show pool venue if the match has no specific location
    final displayVenue = match.location ?? poolVenueMap[match.round];

    // Group/pool badge
    final groupLabel = match.round.isNotEmpty && !match.round.startsWith('Round')
        ? match.round
        : null;

    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.cardElevated(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: _statusColor(status).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  _statusLabel(status),
                  style: TextStyle(
                    color: _statusColor(status),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (groupLabel != null) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppThemeTokens.primary500.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    groupLabel,
                    style: TextStyle(
                      color: AppThemeTokens.primary500,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
              if (match.scheduledAt != null) ...[
                const SizedBox(width: 8),
                Text(
                  fmt.format(match.scheduledAt!.toLocal()),
                  style: TextStyle(
                    fontSize: 12,
                    color: AppThemeTokens.textMuted(context),
                  ),
                ),
              ],
              const Spacer(),
              if (groupLabel == null && match.round.isNotEmpty)
                Text(
                  match.round,
                  style: TextStyle(
                    fontSize: 11,
                    color: AppThemeTokens.textMuted(context),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  match.teamAName ?? 'TBD',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (isCompleted) ...[
                Text('${match.scoreA}', style: const TextStyle(fontWeight: FontWeight.bold)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text('–',
                      style: TextStyle(color: AppThemeTokens.textMuted(context))),
                ),
                Text('${match.scoreB}', style: const TextStyle(fontWeight: FontWeight.bold)),
              ] else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text('vs',
                      style: TextStyle(color: AppThemeTokens.textMuted(context))),
                ),
              Expanded(
                child: Text(
                  match.teamBName ?? 'TBD',
                  textAlign: TextAlign.end,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          if (displayVenue != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.location_on_outlined,
                    size: 12, color: AppThemeTokens.textMuted(context)),
                const SizedBox(width: 4),
                Text(
                  displayVenue,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppThemeTokens.textMuted(context),
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
