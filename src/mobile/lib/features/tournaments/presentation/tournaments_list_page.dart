import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/error_utils.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/auth/state/auth_notifier.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/tournament_repository_impl.dart';
import '../state/tournaments_notifier.dart';

const _kAccent = Color(0xFFFF9800);

// ===========================================================================
// Tournaments List Page
// ===========================================================================

class TournamentsPage extends ConsumerStatefulWidget {
  const TournamentsPage({super.key});

  @override
  ConsumerState<TournamentsPage> createState() => _TournamentsPageState();
}

class _TournamentsPageState extends ConsumerState<TournamentsPage> {
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';
  String? _statusFilter;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tournamentsAsync = ref.watch(tournamentsNotifierProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tournaments'),
        actions: [
          IconButton(
            icon: const Icon(Icons.mail_outline),
            tooltip: 'My Invitations',
            onPressed: () => context.push('/tournaments/invitations'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/tournaments/create'),
        tooltip: 'Create tournament',
        child: const Icon(Icons.add),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search tournaments…',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 20),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
              onChanged: (v) => setState(() => _searchQuery = v),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                for (final s in [null, 'draft', 'registration', 'in_progress', 'completed', 'cancelled'])
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: FilterChip(
                      label: Text(s == null ? 'All' : _formatStatus(s)),
                      selected: _statusFilter == s,
                      onSelected: (_) => setState(() => _statusFilter = s),
                    ),
                  ),
              ]),
            ),
          ),
          Expanded(
            child: tournamentsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorDisplay(
                message: extractErrorMessage(e),
                onRetry: () =>
                    ref.read(tournamentsNotifierProvider.notifier).reload(),
              ),
              data: (all) {
                final tournaments = all.where((t) {
                  if (_statusFilter != null && t.status != _statusFilter) return false;
                  if (_searchQuery.isNotEmpty &&
                      !t.name.toLowerCase().contains(_searchQuery.toLowerCase())) return false;
                  return true;
                }).toList();
                if (tournaments.isEmpty) {
                  return const UiEmptyState(
                    icon: Icons.emoji_events_outlined,
                    message: 'No tournaments found.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () =>
                      ref.read(tournamentsNotifierProvider.notifier).reload(),
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                    itemCount: tournaments.length,
                    itemBuilder: (ctx, i) {
                      final t = tournaments[i];
                      return _TournamentCard(
                        tournament: t,
                        onTap: () => context.push('/tournaments/${t.id}'),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  String _formatStatus(String s) {
    const m = {
      'draft': 'Draft',
      'registration': 'Registration',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return m[s] ?? s;
  }
}

// ---------------------------------------------------------------------------
// Tournament list card
// ---------------------------------------------------------------------------

class _TournamentCard extends StatelessWidget {
  const _TournamentCard({required this.tournament, required this.onTap});

  final TournamentModel tournament;
  final VoidCallback onTap;

  String _formatStatus(String s) {
    const m = {
      'draft': 'Draft',
      'registration': 'Registration',
      'active': 'Active',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return m[s] ?? s;
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'registration':
        return Colors.green;
      case 'in_progress':
      case 'active':
        return Colors.blue;
      case 'completed':
        return Colors.grey;
      case 'cancelled':
        return Colors.red;
      default:
        return _kAccent;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = tournament;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: AppThemeTokens.card(context),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.border(context)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      t.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _statusColor(t.status).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _formatStatus(t.status),
                      style: TextStyle(
                          color: _statusColor(t.status),
                          fontSize: 11,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              if (t.description != null) ...[
                const SizedBox(height: 4),
                Text(
                  t.description!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      color: AppThemeTokens.textSecondary(context),
                      fontSize: 13),
                ),
              ],
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.sports_outlined,
                      size: 14,
                      color: AppThemeTokens.textMuted(context)),
                  const SizedBox(width: 4),
                  Text(t.sportType,
                      style: TextStyle(
                          color: AppThemeTokens.textMuted(context),
                          fontSize: 12)),
                  const SizedBox(width: 12),
                  Icon(Icons.people_outline,
                      size: 14,
                      color: AppThemeTokens.textMuted(context)),
                  const SizedBox(width: 4),
                  Text(
                    '${t.teamCount} teams',
                    style: TextStyle(
                        color: AppThemeTokens.textMuted(context),
                        fontSize: 12),
                  ),
                  if (t.startDate != null) ...[
                    const SizedBox(width: 12),
                    Icon(Icons.calendar_today_outlined,
                        size: 14,
                        color: AppThemeTokens.textMuted(context)),
                    const SizedBox(width: 4),
                    Text(
                      DateFormat.yMMMd()
                          .format(t.startDate!.toLocal()),
                      style: TextStyle(
                          color: AppThemeTokens.textMuted(context),
                          fontSize: 12),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

