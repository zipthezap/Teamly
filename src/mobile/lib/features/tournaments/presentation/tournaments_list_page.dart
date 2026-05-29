import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/models/tournament_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/ui_primitives.dart';
import 'tournament_match_utils.dart';
import 'tournament_status_presentation.dart';
import 'tournament_status_policy.dart';
import '../state/tournaments_notifier.dart';

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
    final invitesAsync = ref.watch(myInvitationsCountProvider);
    final invitesCount = invitesAsync.maybeWhen(data: (c) => c, orElse: () => 0);

    return MobileShell(
      title: 'Tournaments',
      currentIndex: 3,
      actions: [
        IconButton(
          tooltip: 'My Invitations',
          onPressed: () => context.push('/tournaments/invitations'),
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              const Icon(Icons.mail_outline),
              if (invitesCount > 0)
                Positioned(
                  right: -6,
                  top: -6,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFA000),
                      borderRadius: BorderRadius.circular(100),
                      border: Border.all(
                        color: Theme.of(context).colorScheme.surface,
                        width: 1.5,
                      ),
                    ),
                    child: Text(
                      invitesCount > 99 ? '99+' : '$invitesCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/tournaments/create'),
        tooltip: 'Create tournament',
        child: const Icon(Icons.add),
      ),
      child: Column(
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
                  if (_statusFilter != null && t.status != _statusFilter) {
                    return false;
                  }
                  if (_searchQuery.isNotEmpty &&
                      !t.name.toLowerCase().contains(_searchQuery.toLowerCase())) {
                    return false;
                  }
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
    return getTournamentStageLabel(status: s);
  }
}

// ---------------------------------------------------------------------------
// Tournament list card
// ---------------------------------------------------------------------------

class _TournamentCard extends StatelessWidget {
  const _TournamentCard({required this.tournament, required this.onTap});

  final TournamentModel tournament;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = tournament;
    final groupMatches = t.matches.where(isGroupStageMatch).toList();
    final hasKnockout = t.matches.any(isKnockoutStageMatch);
    final allGroupsDone = groupMatches.isNotEmpty && groupMatches.every((m) => m.status == 'completed');
    final statusPresentation = getTournamentStatusPresentation(
      status: t.status,
      isFormingKnockoutBrackets: t.format == 'groups_knockout' && allGroupsDone && !hasKnockout,
      registrationStartDate: t.registrationStartDate,
      registrationDeadline: t.registrationDeadline,
    );
    final statusColor = statusPresentation.color;
    final statusBgColor = statusPresentation.backgroundColor;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: AppThemeTokens.cardElevated(context),
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
                      color: statusBgColor,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          statusPresentation.icon,
                          size: 12,
                          color: statusColor,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          statusPresentation.label,
                          style: TextStyle(
                            color: statusColor,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
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
