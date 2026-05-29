import 'package:flutter/material.dart';
import '../../../core/error/error_utils.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/models/league_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../state/leagues_notifier.dart';

class LeaguesPage extends ConsumerWidget {
  const LeaguesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaguesAsync = ref.watch(leaguesNotifierProvider);

    return MobileShell(
      title: 'Leagues',
      currentIndex: 3,
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/leagues/create'),
        tooltip: 'Create league',
        child: const Icon(Icons.add),
      ),
      child: leaguesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => ErrorDisplay(
          message: extractErrorMessage(err),
          onRetry: () => ref.read(leaguesNotifierProvider.notifier).refresh(),
        ),
        data: (leagues) {
          if (leagues.isEmpty) {
            return const UiEmptyState(
              icon: Icons.military_tech_outlined,
              title: 'No leagues yet',
              message: 'Create a league to run recurring competitions.',
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.read(leaguesNotifierProvider.notifier).refresh(),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
              itemCount: leagues.length,
              itemBuilder: (context, index) {
                final league = leagues[index];
                return _LeagueCard(
                  league: league,
                  onTap: () => context.push('/leagues/${league.id}'),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

// ── Card ───────────────────────────────────────────────────────────────────────

class _LeagueCard extends StatelessWidget {
  const _LeagueCard({required this.league, required this.onTap});

  final LeagueModel league;
  final VoidCallback onTap;

  static const _accentColor = Color(0xFF8B5CF6); // purple — distinct from tournament orange

  Color _statusColor(String? status) {
    switch (status) {
      case 'active':
        return AppThemeTokens.success;
      case 'completed':
        return AppThemeTokens.darkTextMuted;
      case 'cancelled':
        return AppThemeTokens.error;
      default:
        return AppThemeTokens.warning; // draft / registration
    }
  }

  String _statusLabel(String? status) {
    const m = {
      'draft': 'Draft',
      'registration': 'Open',
      'active': 'Active',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return m[status] ?? 'Draft';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
    final border = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final textSecondary = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header strip ─────────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _accentColor.withValues(alpha: 0.12),
                borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(AppThemeTokens.radiusMd)),
              ),
              child: Row(
                children: [
                  Icon(Icons.military_tech_rounded,
                      color: _accentColor, size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      league.name,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Status badge
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _statusColor(league.status).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: Text(
                      _statusLabel(league.status),
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: _statusColor(league.status),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Body ─────────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Sport + Teams + schedule chips row
                  Row(
                    children: [
                      _Chip(
                        icon: Icons.sports_soccer_outlined,
                        label: league.sport,
                        color: textSecondary,
                      ),
                      const SizedBox(width: 8),
                      _Chip(
                        icon: Icons.groups_outlined,
                        label: '${league.memberCount} teams',
                        color: textSecondary,
                      ),
                      const SizedBox(width: 8),
                      _Chip(
                        icon: league.scheduleType == LeagueScheduleType.sessions
                            ? Icons.format_list_numbered
                            : Icons.calendar_today_outlined,
                        label: league.scheduleType == LeagueScheduleType.sessions
                            ? 'Sessions'
                            : 'Duration',
                        color: _accentColor,
                      ),
                    ],
                  ),

                  const SizedBox(height: 10),

                  // Progress bar
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(100),
                          child: LinearProgressIndicator(
                            value: league.progress,
                            minHeight: 5,
                            backgroundColor:
                                _accentColor.withValues(alpha: 0.15),
                            valueColor:
                                AlwaysStoppedAnimation<Color>(_accentColor),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        league.progressLabel,
                        style: TextStyle(
                          fontSize: 10,
                          color: textSecondary,
                          fontFamily: 'Inter',
                        ),
                      ),
                    ],
                  ),

                  // Date range (if applicable)
                  if (league.startDate != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      _formatDateRange(league.startDate!, league.endDate),
                      style: TextStyle(
                        fontSize: 11,
                        color: textSecondary,
                        fontFamily: 'Inter',
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDateRange(DateTime start, DateTime? end) {
    final fmt = DateFormat('d MMM yyyy');
    if (end == null) return 'From ${fmt.format(start)}';
    return '${fmt.format(start)} – ${fmt.format(end)}';
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 3),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: color,
            fontFamily: 'Inter',
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
