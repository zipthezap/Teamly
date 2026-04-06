import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/models/tournament_model.dart';
import '../../../shared/widgets/error_display.dart';
import '../data/tournament_repository_impl.dart';
import '../state/tournaments_notifier.dart';

class TournamentsPage extends ConsumerStatefulWidget {
  const TournamentsPage({super.key});

  @override
  ConsumerState<TournamentsPage> createState() => _TournamentsPageState();
}

class _TournamentsPageState extends ConsumerState<TournamentsPage> {
  @override
  Widget build(BuildContext context) {
    final tournamentsAsync = ref.watch(tournamentsNotifierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tournaments')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/tournaments/create'),
        tooltip: 'Create tournament',
        child: const Icon(Icons.add),
      ),
      body: tournamentsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () => ref.read(tournamentsNotifierProvider.notifier).load(),
        ),
        data: (tournaments) {
          if (tournaments.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.emoji_events_outlined, size: 56, color: Colors.grey),
                    SizedBox(height: 12),
                    Text(
                      'No tournaments yet.',
                      style: TextStyle(color: Colors.grey),
                    ),
                  ],
                ),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () =>
                ref.read(tournamentsNotifierProvider.notifier).load(),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: tournaments.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (ctx, i) {
                final t = tournaments[i];
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor:
                        Theme.of(ctx).colorScheme.primaryContainer,
                    child: Icon(
                      Icons.emoji_events_outlined,
                      color: Theme.of(ctx).colorScheme.onPrimaryContainer,
                    ),
                  ),
                  title: Text(t.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text(
                    [
                      sportTypeLabel(t.sportType),
                      _formatStatus(t.status),
                      '${t.teamCount} team${t.teamCount == 1 ? '' : 's'}',
                      if (t.startDate != null)
                        DateFormat('MMM d, y').format(t.startDate!.toLocal()),
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/tournaments/${t.id}'),
                );
              },
            ),
          );
        },
      ),
    );
  }

  String _formatStatus(String status) {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'registration':
        return 'Registration';
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  }
}

// ---------------------------------------------------------------------------
// Tournament detail page
// ---------------------------------------------------------------------------

class TournamentDetailPage extends ConsumerWidget {
  const TournamentDetailPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tournamentAsync = ref.watch(tournamentDetailProvider(tournamentId));
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: tournamentAsync.maybeWhen(
          data: (t) => Text(t.name),
          orElse: () => const Text('Tournament'),
        ),
      ),
      body: tournamentAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(
          message: e.toString(),
          onRetry: () =>
              ref.invalidate(tournamentDetailProvider(tournamentId)),
        ),
        data: (t) => RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(tournamentDetailProvider(tournamentId)),
          child: DefaultTabController(
            length: 3,
            child: NestedScrollView(
              headerSliverBuilder: (context, _) => [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Status chip + sport
                        Wrap(
                          spacing: 8,
                          children: [
                            Chip(label: Text(sportTypeLabel(t.sportType))),
                            Chip(
                              label: Text(_statusLabel(t.status)),
                              backgroundColor: _statusColor(t.status, theme),
                            ),
                            Chip(label: Text(_formatLabel(t.format))),
                          ],
                        ),
                        if (t.description != null) ...[
                          const SizedBox(height: 8),
                          Text(t.description!),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          '${t.teamCount} team${t.teamCount == 1 ? '' : 's'}${t.maxTeams != null ? ' / ${t.maxTeams} max' : ''}',
                          style: theme.textTheme.bodySmall,
                        ),
                        if (t.startDate != null)
                          Text(
                            'Starts: ${DateFormat.yMMMd().format(t.startDate!.toLocal())}',
                            style: theme.textTheme.bodySmall,
                          ),
                      ],
                    ),
                  ),
                ),
                const SliverPersistentHeader(
                  delegate: _TabBarDelegate(
                    TabBar(
                      tabs: [
                        Tab(text: 'Teams'),
                        Tab(text: 'Matches'),
                        Tab(text: 'Standings'),
                      ],
                    ),
                  ),
                  pinned: true,
                ),
              ],
              body: TabBarView(
                children: [
                  _TeamsTab(teams: t.teams, format: t.format),
                  _MatchesTab(matches: t.matches),
                  _StandingsTab(teams: t.teams, format: t.format),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _statusLabel(String s) {
    const m = {
      'draft': 'Draft',
      'registration': 'Registration',
      'active': 'Active',
      'completed': 'Completed',
    };
    return m[s] ?? s;
  }

  Color? _statusColor(String s, ThemeData theme) {
    switch (s) {
      case 'active':
        return Colors.green.shade100;
      case 'registration':
        return theme.colorScheme.primaryContainer;
      case 'completed':
        return Colors.grey.shade200;
      default:
        return null;
    }
  }

  String _formatLabel(String f) {
    const m = {
      'bracket': 'Bracket',
      'pool': 'Pool',
      'round_robin': 'Round Robin',
    };
    return m[f] ?? f;
  }
}

class _TeamsTab extends StatelessWidget {
  const _TeamsTab({required this.teams, required this.format});
  final List<TournamentTeamModel> teams;
  final String format;

  @override
  Widget build(BuildContext context) {
    if (teams.isEmpty) {
      return const Center(
        child: Text('No teams registered yet.', style: TextStyle(color: Colors.grey)),
      );
    }

    // Group by pool if pool format
    final hasPools = format == 'pool' &&
        teams.any((t) => t.poolId != null);

    if (hasPools) {
      final pools = <String, List<TournamentTeamModel>>{};
      for (final team in teams) {
        final poolKey = team.poolId ?? 'No Pool';
        pools.putIfAbsent(poolKey, () => []).add(team);
      }
      return ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: pools.entries.map((entry) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Text('Pool ${entry.key}',
                    style: Theme.of(context).textTheme.titleSmall),
              ),
              ...entry.value.asMap().entries.map((e) => ListTile(
                    leading: CircleAvatar(child: Text('${e.key + 1}')),
                    title: Text(e.value.name),
                    trailing: e.value.wins + e.value.losses > 0
                        ? Text('${e.value.wins}W / ${e.value.losses}L',
                            style: const TextStyle(fontSize: 12))
                        : null,
                  )),
              const Divider(),
            ],
          );
        }).toList(),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: teams.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (ctx, i) {
        final team = teams[i];
        return ListTile(
          leading: CircleAvatar(child: Text('${i + 1}')),
          title: Text(team.name),
          trailing: team.wins + team.losses > 0
              ? Text('${team.wins}W / ${team.losses}L',
                  style: const TextStyle(fontSize: 12))
              : null,
        );
      },
    );
  }
}

class _StandingsTab extends StatelessWidget {
  const _StandingsTab({required this.teams, required this.format});
  final List<TournamentTeamModel> teams;
  final String format;

  @override
  Widget build(BuildContext context) {
    if (teams.isEmpty) {
      return const Center(
        child: Text('No standings yet.', style: TextStyle(color: Colors.grey)),
      );
    }

    final hasStats = teams.any((t) => t.wins + t.losses > 0);

    if (!hasStats) {
      return Center(
        child: Text(
          'Standings will be available once matches are played.',
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: Colors.grey),
          textAlign: TextAlign.center,
        ),
      );
    }

    // Sort by points desc, then wins desc
    final sorted = [...teams]
      ..sort((a, b) {
        final ptsDiff = b.points.compareTo(a.points);
        if (ptsDiff != 0) return ptsDiff;
        return b.wins.compareTo(a.wins);
      });

    final theme = Theme.of(context);

    return Column(
      children: [
        // Header row
        Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: theme.colorScheme.surfaceContainerHighest,
          child: Row(
            children: [
              const SizedBox(width: 36),
              const Expanded(
                child: Text('Team',
                    style: TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 12)),
              ),
              const SizedBox(
                  width: 40,
                  child: Text('W',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 12))),
              const SizedBox(
                  width: 40,
                  child: Text('L',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 12))),
              const SizedBox(
                  width: 40,
                  child: Text('Pts',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 12))),
            ],
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: EdgeInsets.zero,
            itemCount: sorted.length,
            separatorBuilder: (_, __) =>
                const Divider(height: 1, indent: 16),
            itemBuilder: (ctx, i) {
              final team = sorted[i];
              final isTop3 = i < 3;
              return Container(
                color: isTop3
                    ? [
                        Colors.amber.withValues(alpha: 0.15),
                        Colors.grey.shade300.withValues(alpha: 0.3),
                        Colors.brown.shade200.withValues(alpha: 0.2),
                      ][i]
                    : null,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 36,
                        child: Text(
                          '${i + 1}',
                          style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: isTop3 ? theme.colorScheme.primary : null),
                        ),
                      ),
                      Expanded(
                          child: Text(team.name,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w500))),
                      SizedBox(
                          width: 40,
                          child: Text('${team.wins}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  color: Colors.green,
                                  fontWeight: FontWeight.bold))),
                      SizedBox(
                          width: 40,
                          child: Text('${team.losses}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  color: Colors.red,
                                  fontWeight: FontWeight.bold))),
                      SizedBox(
                          width: 40,
                          child: Text('${team.points}',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  color: theme.colorScheme.primary,
                                  fontWeight: FontWeight.bold))),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _MatchesTab extends StatelessWidget {
  const _MatchesTab({required this.matches});
  final List<TournamentMatchModel> matches;

  @override
  Widget build(BuildContext context) {
    if (matches.isEmpty) {
      return const Center(
        child: Text('No matches scheduled yet.', style: TextStyle(color: Colors.grey)),
      );
    }

    // Group by round
    final rounds = <String, List<TournamentMatchModel>>{};
    for (final m in matches) {
      rounds.putIfAbsent(m.round, () => []).add(m);
    }

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: rounds.entries.map((entry) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Text(
                entry.key,
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            ...entry.value.map((m) => _MatchTile(match: m)),
          ],
        );
      }).toList(),
    );
  }
}

class _MatchTile extends StatelessWidget {
  const _MatchTile({required this.match});
  final TournamentMatchModel match;

  @override
  Widget build(BuildContext context) {
    final teamA = match.teamAName ?? 'TBD';
    final teamB = match.teamBName ?? 'TBD';
    final hasScore = match.scoreA != null && match.scoreB != null;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Text(
                teamA,
                textAlign: TextAlign.end,
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                hasScore
                    ? '${match.scoreA} – ${match.scoreB}'
                    : 'vs',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
            Expanded(
              child: Text(
                teamB,
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Create Tournament page
// ---------------------------------------------------------------------------

class CreateTournamentPage extends ConsumerStatefulWidget {
  const CreateTournamentPage({super.key});

  @override
  ConsumerState<CreateTournamentPage> createState() =>
      _CreateTournamentPageState();
}

class _CreateTournamentPageState extends ConsumerState<CreateTournamentPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _maxTeamsCtrl = TextEditingController();

  String _sportType = '';
  String _format = 'bracket';
  DateTime? _startDate;
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _maxTeamsCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickStartDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _startDate ?? DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (d != null) setState(() => _startDate = d);
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      final t = await ref.read(tournamentRepositoryProvider).createTournament({
        'name': _nameCtrl.text.trim(),
        if (_sportType.isNotEmpty) 'sportType': _sportType,
        'format': _format,
        if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
        if (_maxTeamsCtrl.text.trim().isNotEmpty)
          'maxTeams': int.tryParse(_maxTeamsCtrl.text.trim()),
        if (_startDate != null) 'startDate': _startDate!.toIso8601String(),
      });
      ref.read(tournamentsNotifierProvider.notifier).load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tournament created!')),
        );
        context.go('/tournaments/${t.id}');
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
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Tournament')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Tournament name *',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.words,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 16),

            DropdownButtonFormField<String>(
              value: _sportType,
              decoration: const InputDecoration(
                labelText: 'Sport type',
                border: OutlineInputBorder(),
              ),
              items: kSportTypes
                  .map(
                    (s) => DropdownMenuItem(
                      value: s['value'],
                      child: Text(s['label']!),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _sportType = v ?? ''),
            ),
            const SizedBox(height: 16),

            DropdownButtonFormField<String>(
              value: _format,
              decoration: const InputDecoration(
                labelText: 'Format',
                border: OutlineInputBorder(),
              ),
              items: kTournamentFormats
                  .map(
                    (f) => DropdownMenuItem(
                      value: f['value'],
                      child: Text(f['label']!),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _format = v ?? 'bracket'),
            ),
            const SizedBox(height: 16),

            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 16),

            TextFormField(
              controller: _maxTeamsCtrl,
              decoration: const InputDecoration(
                labelText: 'Max teams (optional)',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),

            InkWell(
              onTap: _pickStartDate,
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Start date (optional)',
                  prefixIcon: Icon(Icons.calendar_today_outlined),
                  border: OutlineInputBorder(),
                ),
                child: Text(
                  _startDate != null
                      ? DateFormat.yMMMd().format(_startDate!)
                      : 'Tap to select',
                  style: TextStyle(
                    color: _startDate == null ? Colors.grey : null,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),

            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: _saving ? null : _submit,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Create Tournament'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Persistent tab bar delegate
// ---------------------------------------------------------------------------

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  const _TabBarDelegate(this.tabBar);
  final TabBar tabBar;

  @override
  double get minExtent => tabBar.preferredSize.height;
  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_TabBarDelegate old) => old.tabBar != tabBar;
}
