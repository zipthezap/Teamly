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
import '../../auth/state/auth_notifier.dart';
import 'tournament_match_utils.dart';
import 'tournament_status_presentation.dart';
import '../state/tournaments_notifier.dart';

class TournamentsPage extends ConsumerStatefulWidget {
  const TournamentsPage({super.key});

  @override
  ConsumerState<TournamentsPage> createState() => _TournamentsPageState();
}

class _TournamentsPageState extends ConsumerState<TournamentsPage> {
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';
  bool _showPastTournaments = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tournamentsAsync = ref.watch(tournamentsNotifierProvider);
    final currentUserId = ref.watch(authNotifierProvider).user?.id;
    final invitesAsync = ref.watch(myInvitationsCountProvider);
    final invitesCount =
        invitesAsync.maybeWhen(data: (c) => c, orElse: () => 0);

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
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () => setState(
                    () => _showPastTournaments = !_showPastTournaments),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 24,
                        height: 24,
                        child: Checkbox(
                          value: _showPastTournaments,
                          onChanged: (selected) => setState(
                            () => _showPastTournaments = selected ?? false,
                          ),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Show past',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppThemeTokens.textSecondary(context),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
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
                final entries = all
                    .map(
                  (t) => _TournamentListEntry(
                    tournament: t,
                    myTeam: _findMyTeam(t, currentUserId),
                  ),
                )
                    .where((entry) {
                  final tournament = entry.tournament;
                  if (!_showPastTournaments &&
                      _isPastTournament(
                        tournament,
                        isParticipating: entry.isParticipating,
                      )) {
                    return false;
                  }
                  if (_searchQuery.isNotEmpty &&
                      !tournament.name
                          .toLowerCase()
                          .contains(_searchQuery.toLowerCase())) {
                    return false;
                  }
                  return true;
                }).toList()
                  ..sort(_compareTournamentPriorityAndDate);

                if (entries.isEmpty) {
                  return const UiEmptyState(
                    icon: Icons.emoji_events_outlined,
                    message: 'No tournaments found.',
                  );
                }

                return RefreshIndicator(
                  onRefresh: () =>
                      ref.read(tournamentsNotifierProvider.notifier).reload(),
                  child: ListView(
                    padding: const EdgeInsets.symmetric(
                        vertical: 12, horizontal: 16),
                    children: [
                      Text(
                        'Tournaments',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppThemeTokens.textSecondary(context),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _showPastTournaments
                            ? 'My in-progress tournaments first, then upcoming by date, then past.'
                            : 'My in-progress tournaments first, then upcoming by nearest start date.',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppThemeTokens.textMuted(context),
                        ),
                      ),
                      const SizedBox(height: 10),
                      for (final entry in entries)
                        _TournamentCard(
                          tournament: entry.tournament,
                          myTeam: entry.myTeam,
                          treatInProgressAsPast:
                              entry.tournament.status == 'in_progress' &&
                                  !entry.isParticipating,
                          onTap: () => context
                              .push('/tournaments/${entry.tournament.id}'),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  bool _isPastTournament(
    TournamentModel tournament, {
    required bool isParticipating,
  }) {
    if (tournament.status == 'in_progress') {
      return !isParticipating;
    }

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final date =
        tournament.endDate ?? tournament.startDate ?? tournament.createdAt;
    final tournamentDay = DateTime(date.year, date.month, date.day);
    return tournamentDay.isBefore(today);
  }

  int _compareTournamentPriorityAndDate(
    _TournamentListEntry a,
    _TournamentListEntry b,
  ) {
    final aTournament = a.tournament;
    final bTournament = b.tournament;
    final aInProgress =
        aTournament.status == 'in_progress' && a.isParticipating;
    final bInProgress =
        bTournament.status == 'in_progress' && b.isParticipating;
    if (aInProgress != bInProgress) {
      return aInProgress ? -1 : 1;
    }

    final aPast =
        _isPastTournament(aTournament, isParticipating: a.isParticipating);
    final bPast =
        _isPastTournament(bTournament, isParticipating: b.isParticipating);
    if (aPast != bPast) {
      return aPast ? 1 : -1;
    }

    final aDate =
        aTournament.startDate ?? aTournament.endDate ?? aTournament.createdAt;
    final bDate =
        bTournament.startDate ?? bTournament.endDate ?? bTournament.createdAt;
    if (aPast && bPast) {
      final comparePast = bDate.compareTo(aDate);
      if (comparePast != 0) return comparePast;
      return aTournament.name.compareTo(bTournament.name);
    }

    final compareUpcoming = aDate.compareTo(bDate);
    if (compareUpcoming != 0) return compareUpcoming;
    return aTournament.name.compareTo(bTournament.name);
  }

  TournamentTeamModel? _findMyTeam(
      TournamentModel tournament, String? currentUserId) {
    if (tournament.myTeam != null) {
      return tournament.myTeam;
    }
    if (currentUserId == null) return null;

    for (final team in tournament.teams) {
      final isMember = team.captainUserId == currentUserId ||
          team.players
              .any((player) => (player['userId'] as String?) == currentUserId);
      if (isMember) {
        return team;
      }
    }
    return null;
  }
}

class _TournamentListEntry {
  const _TournamentListEntry({
    required this.tournament,
    required this.myTeam,
  });

  final TournamentModel tournament;
  final TournamentTeamModel? myTeam;

  bool get isParticipating => myTeam != null;
}

class _TournamentCard extends StatelessWidget {
  const _TournamentCard({
    required this.tournament,
    required this.onTap,
    required this.treatInProgressAsPast,
    this.myTeam,
  });

  final TournamentModel tournament;
  final VoidCallback onTap;
  final bool treatInProgressAsPast;
  final TournamentTeamModel? myTeam;

  @override
  Widget build(BuildContext context) {
    final t = tournament;
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      t.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                  ),
                  if (myTeam != null) ...[
                    const SizedBox(width: 8),
                    _ParticipationTeamChip(teamName: myTeam!.name),
                  ],
                ],
              ),
              if (t.description != null) ...[
                const SizedBox(height: 6),
                Text(
                  t.description!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppThemeTokens.textSecondary(context),
                    fontSize: 13,
                  ),
                ),
              ],
              const SizedBox(height: 8),
              _TournamentMetaRow(tournament: t),
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerRight,
                child: _TournamentStatusBadge(
                  tournament: t,
                  subtle: true,
                  treatInProgressAsPast: treatInProgressAsPast,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ParticipationTeamChip extends StatelessWidget {
  const _ParticipationTeamChip({required this.teamName});

  final String teamName;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 170),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: AppThemeTokens.primary500.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: AppThemeTokens.primary500.withValues(alpha: 0.40),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.verified,
              size: 12,
              color: AppThemeTokens.primary500,
            ),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                teamName,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppThemeTokens.primary500,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TournamentStatusBadge extends StatefulWidget {
  const _TournamentStatusBadge({
    required this.tournament,
    required this.treatInProgressAsPast,
    this.subtle = false,
  });

  final TournamentModel tournament;
  final bool subtle;
  final bool treatInProgressAsPast;

  @override
  State<_TournamentStatusBadge> createState() => _TournamentStatusBadgeState();
}

class _TournamentStatusBadgeState extends State<_TournamentStatusBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isVisibleInProgress = widget.tournament.status == 'in_progress' &&
        !widget.treatInProgressAsPast;

    if (isVisibleInProgress) {
      return AnimatedBuilder(
        animation: _pulseController,
        builder: (context, child) {
          final pulse = Curves.easeInOut.transform(_pulseController.value);
          final badgeBg = Color.lerp(
            const Color(0xFFDDF0FF),
            const Color(0xFFC4E4FF),
            pulse,
          )!;
          final borderColor = Color.lerp(
            const Color(0xFF7DBAF4),
            const Color(0xFF3695EE),
            pulse,
          )!;
          final textColor = Color.lerp(
            const Color(0xFF2C7FD1),
            const Color(0xFF156FC4),
            pulse,
          )!;

          return _buildBadge(
            context: context,
            label: 'In Progress',
            icon: Icons.motion_photos_on,
            textColor: textColor,
            backgroundColor: badgeBg,
            borderColor: borderColor,
            boxShadowColor: borderColor.withValues(alpha: 0.26),
            subtle: widget.subtle,
          );
        },
      );
    }

    if (widget.treatInProgressAsPast &&
        widget.tournament.status == 'in_progress') {
      return _buildBadge(
        context: context,
        label: 'Past',
        icon: Icons.history,
        textColor: AppThemeTokens.textMuted(context),
        backgroundColor: AppThemeTokens.card(context),
        borderColor: AppThemeTokens.border(context),
        subtle: widget.subtle,
      );
    }

    final tournament = widget.tournament;
    final groupMatches = tournament.matches.where(isGroupStageMatch).toList();
    final hasKnockout = tournament.matches.any(isKnockoutStageMatch);
    final allGroupsDone = groupMatches.isNotEmpty &&
        groupMatches.every((m) => m.status == 'completed');
    final statusPresentation = getTournamentStatusPresentation(
      status: tournament.status,
      isFormingKnockoutBrackets: tournament.format == 'groups_knockout' &&
          allGroupsDone &&
          !hasKnockout,
      registrationStartDate: tournament.registrationStartDate,
      registrationDeadline: tournament.registrationDeadline,
    );

    final statusColor = widget.subtle
        ? AppThemeTokens.textMuted(context)
        : statusPresentation.color;
    final statusBgColor = widget.subtle
        ? AppThemeTokens.card(context)
        : statusPresentation.backgroundColor;

    return _buildBadge(
      context: context,
      label: statusPresentation.label,
      icon: statusPresentation.icon,
      textColor: statusColor,
      backgroundColor: statusBgColor,
      borderColor: widget.subtle
          ? AppThemeTokens.border(context)
          : statusColor.withValues(alpha: 0.3),
      subtle: widget.subtle,
    );
  }

  Widget _buildBadge({
    required BuildContext context,
    required String label,
    required IconData icon,
    required Color textColor,
    required Color backgroundColor,
    required Color borderColor,
    required bool subtle,
    Color? boxShadowColor,
  }) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: subtle ? 6 : 8,
        vertical: subtle ? 2 : 3,
      ),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor),
        boxShadow: boxShadowColor == null
            ? null
            : [
                BoxShadow(
                  color: boxShadowColor,
                  blurRadius: 8,
                  spreadRadius: 0.5,
                ),
              ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: subtle ? 10 : 12, color: textColor),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: textColor,
              fontSize: subtle ? 10 : 11,
              fontWeight: subtle ? FontWeight.w500 : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _TournamentMetaRow extends StatelessWidget {
  const _TournamentMetaRow({required this.tournament});

  final TournamentModel tournament;

  @override
  Widget build(BuildContext context) {
    final items = <Widget>[
      Icon(Icons.sports_outlined,
          size: 14, color: AppThemeTokens.textMuted(context)),
      const SizedBox(width: 4),
      Text(
        tournament.sportType,
        style: TextStyle(
          color: AppThemeTokens.textMuted(context),
          fontSize: 12,
        ),
      ),
      const SizedBox(width: 12),
      Icon(Icons.people_outline,
          size: 14, color: AppThemeTokens.textMuted(context)),
      const SizedBox(width: 4),
      Text(
        '${tournament.teamCount} teams',
        style: TextStyle(
          color: AppThemeTokens.textMuted(context),
          fontSize: 12,
        ),
      ),
    ];

    if (tournament.startDate != null) {
      items.addAll([
        const SizedBox(width: 12),
        Icon(Icons.calendar_today_outlined,
            size: 14, color: AppThemeTokens.textMuted(context)),
        const SizedBox(width: 4),
        Text(
          DateFormat.yMMMd().format(tournament.startDate!.toLocal()),
          style: TextStyle(
            color: AppThemeTokens.textMuted(context),
            fontSize: 12,
          ),
        ),
      ]);
    }

    return Wrap(
      spacing: 0,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: items,
    );
  }
}
