import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../state/tournaments_notifier.dart';
import '../../../core/models/tournament_model.dart';

class TournamentAnalyticsPage extends ConsumerWidget {
  const TournamentAnalyticsPage({super.key, required this.tournamentId});

  final String tournamentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final analyticsAsync = ref.watch(tournamentAnalyticsProvider(tournamentId));

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Analytics'),
        leading: BackButton(onPressed: () => context.pop()),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            tooltip: 'Refresh',
            onPressed: () =>
                ref.invalidate(tournamentAnalyticsProvider(tournamentId)),
          ),
        ],
      ),
      body: analyticsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorDisplay(message: e.toString()),
        data: (analytics) => _AnalyticsDashboard(analytics: analytics),
      ),
    );
  }
}

class _AnalyticsDashboard extends StatelessWidget {
  const _AnalyticsDashboard({required this.analytics});

  final TournamentAnalyticsModel analytics;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _RegistrationSection(registration: analytics.registration),
        const SizedBox(height: 16),
        _MatchesSection(matches: analytics.matches),
        const SizedBox(height: 16),
        _PaymentsSection(payments: analytics.payments),
        const SizedBox(height: 16),
        _DisputesSection(disputes: analytics.disputes),
        const SizedBox(height: 16),
        _IncidentsSection(incidents: analytics.incidents),
        const SizedBox(height: 32),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Registration section
// ---------------------------------------------------------------------------

class _RegistrationSection extends StatelessWidget {
  const _RegistrationSection({required this.registration});

  final TournamentAnalyticsRegistration registration;

  @override
  Widget build(BuildContext context) {
    return UiCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            icon: Icons.people_alt_outlined,
            label: 'Registration',
            color: AppThemeTokens.primary500,
          ),
          const SizedBox(height: 12),
          _StatGrid(stats: [
            _Stat('Total Teams', '${registration.totalTeams}'),
            _Stat('Checked In', '${registration.checkedIn}',
                color: AppThemeTokens.success),
            _Stat('No-shows', '${registration.noShows}',
                color:
                    registration.noShows > 0 ? AppThemeTokens.warning : null),
            _Stat('Waiver OK', '${registration.waiverAccepted}',
                color: AppThemeTokens.info),
          ]),
          if (registration.totalTeams > 0) ...[
            const SizedBox(height: 12),
            _CheckInBar(
              label: 'Check-in progress',
              value: registration.checkedIn / registration.totalTeams,
              color: AppThemeTokens.success,
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Matches section
// ---------------------------------------------------------------------------

class _MatchesSection extends StatelessWidget {
  const _MatchesSection({required this.matches});

  final TournamentAnalyticsMatches matches;

  @override
  Widget build(BuildContext context) {
    return UiCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            icon: Icons.sports_outlined,
            label: 'Matches',
            color: AppThemeTokens.info,
          ),
          const SizedBox(height: 12),
          _StatGrid(stats: [
            _Stat('Total', '${matches.total}'),
            _Stat('Completed', '${matches.completed}',
                color: AppThemeTokens.success),
            _Stat('In Progress', '${matches.inProgress}',
                color: AppThemeTokens.info),
            _Stat('Cancelled', '${matches.cancelled}',
                color: matches.cancelled > 0 ? AppThemeTokens.error : null),
          ]),
          if (matches.lateStarts > 0) ...[
            const SizedBox(height: 8),
            _WarningBanner(
              '${matches.lateStarts} match(es) started more than 10 min late',
            ),
          ],
          if (matches.avgDurationMinutes != null) ...[
            const SizedBox(height: 8),
            Text(
              'Avg. match duration: ${matches.avgDurationMinutes} min',
              style: TextStyle(
                fontSize: 13,
                color: AppThemeTokens.textSecondary(context),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Payments section
// ---------------------------------------------------------------------------

class _PaymentsSection extends StatelessWidget {
  const _PaymentsSection({required this.payments});

  final TournamentAnalyticsPayments payments;

  @override
  Widget build(BuildContext context) {
    return UiCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            icon: Icons.attach_money_outlined,
            label: 'Payments',
            color: AppThemeTokens.success,
          ),
          const SizedBox(height: 12),
          _StatGrid(stats: [
            _Stat('Revenue', '\$${payments.totalRevenue.toStringAsFixed(2)}',
                color: AppThemeTokens.success),
            _Stat('Paid Txns', '${payments.transactionsPaid}'),
            _Stat('Refunds', '${payments.transactionsRefunded}',
                color: payments.transactionsRefunded > 0
                    ? AppThemeTokens.warning
                    : null),
          ]),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Disputes section
// ---------------------------------------------------------------------------

class _DisputesSection extends StatelessWidget {
  const _DisputesSection({required this.disputes});

  final TournamentAnalyticsDisputes disputes;

  @override
  Widget build(BuildContext context) {
    return UiCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            icon: Icons.gavel_outlined,
            label: 'Score Disputes',
            color: AppThemeTokens.warning,
          ),
          const SizedBox(height: 12),
          _StatGrid(stats: [
            _Stat('Total', '${disputes.total}'),
            _Stat('Open', '${disputes.open}',
                color: disputes.open > 0 ? AppThemeTokens.warning : null),
            _Stat('Resolved', '${disputes.resolved}',
                color: AppThemeTokens.success),
            _Stat('Dismissed', '${disputes.dismissed}'),
          ]),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Incidents section
// ---------------------------------------------------------------------------

class _IncidentsSection extends StatelessWidget {
  const _IncidentsSection({required this.incidents});

  final TournamentAnalyticsIncidents incidents;

  @override
  Widget build(BuildContext context) {
    return UiCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            icon: Icons.warning_amber_outlined,
            label: 'Incidents',
            color: AppThemeTokens.error,
          ),
          const SizedBox(height: 12),
          _StatGrid(stats: [
            _Stat('Total', '${incidents.total}'),
            _Stat('Open', '${incidents.open}',
                color: incidents.open > 0 ? AppThemeTokens.warning : null),
            _Stat('Resolved', '${incidents.resolved}',
                color: AppThemeTokens.success),
          ]),
          if (incidents.pastSla > 0) ...[
            const SizedBox(height: 8),
            _WarningBanner(
              '${incidents.pastSla} open incident(s) have exceeded SLA deadline',
              isError: true,
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared widgets
// ---------------------------------------------------------------------------

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Icon(icon, size: 18, color: color),
      const SizedBox(width: 8),
      Text(label,
          style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 15,
              color: AppThemeTokens.text(context))),
    ]);
  }
}

class _Stat {
  const _Stat(this.label, this.value, {this.color});

  final String label;
  final String value;
  final Color? color;
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.stats});

  final List<_Stat> stats;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 8,
      children: stats
          .map((s) => _StatChip(label: s.label, value: s.value, color: s.color))
          .toList(),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? AppThemeTokens.textSecondary(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 22,
            color: effectiveColor,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: AppThemeTokens.textMuted(context),
          ),
        ),
      ],
    );
  }
}

class _CheckInBar extends StatelessWidget {
  const _CheckInBar({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final double value; // 0.0 – 1.0
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$label  (${(value * 100).round()}%)',
          style: TextStyle(
              fontSize: 12, color: AppThemeTokens.textSecondary(context)),
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value.clamp(0.0, 1.0),
            backgroundColor: color.withValues(alpha: 0.15),
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 8,
          ),
        ),
      ],
    );
  }
}

class _WarningBanner extends StatelessWidget {
  const _WarningBanner(this.message, {this.isError = false});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? AppThemeTokens.error : AppThemeTokens.warning;
    final bg = isError ? AppThemeTokens.errorBg : AppThemeTokens.warningBg;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(children: [
        Icon(Icons.warning_amber_rounded, size: 14, color: color),
        const SizedBox(width: 8),
        Expanded(
          child: Text(message, style: TextStyle(fontSize: 12, color: color)),
        ),
      ]),
    );
  }
}
