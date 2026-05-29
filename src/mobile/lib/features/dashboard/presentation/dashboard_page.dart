import 'package:flutter/material.dart';
import '../../../core/error/error_utils.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../features/auth/state/auth_notifier.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/dashboard_model.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../state/dashboard_notifier.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final dashboardAsync = ref.watch(dashboardNotifierProvider);

    final user = authState.user;

    return MobileShell(
      title: 'Teamly',
      currentIndex: 0,
      actions: [
        IconButton(
          icon: user?.profilePicture != null
              ? UserAvatar(name: user!.name, imageUrl: user.profilePicture, radius: 14)
              : const Icon(Icons.account_circle_outlined),
          onPressed: () => context.push('/profile'),
          tooltip: 'Profile',
        ),
      ],
      child: RefreshIndicator(
        onRefresh: () =>
            ref.read(dashboardNotifierProvider.notifier).reload(),
        child: dashboardAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ErrorDisplay(
            message: extractErrorMessage(e),
            onRetry: () =>
                ref.read(dashboardNotifierProvider.notifier).reload(),
          ),
          data: (dashboard) => _DashboardContent(
            user: user,
            greeting: _greeting(),
            dashboard: dashboard,
          ),
        ),
      ),
    );
  }
}

// ── Main content (rendered when dashboard data is loaded) ─────────────────────

class _DashboardContent extends StatelessWidget {
  const _DashboardContent({
    required this.user,
    required this.greeting,
    required this.dashboard,
  });

  final dynamic user;
  final String greeting;
  final DashboardModel dashboard;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        // ── Hero welcome card ────────────────────────────────────────────
        if (user != null) _HeroCard(user: user, greeting: greeting),

        // ── Stat pills ───────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: _StatPill(
                  label: 'Groups',
                  value: '${dashboard.stats.groupCount}',
                  icon: Icons.groups_2_rounded,
                  color: AppThemeTokens.primary500,
                  onTap: () => context.go('/groups'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatPill(
                  label: 'Sessions',
                  value: '${dashboard.stats.totalSessions}',
                  icon: Icons.event_rounded,
                  color: const Color(0xFF7C4DFF),
                  onTap: () => context.go('/sessions'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatPill(
                  label: 'Upcoming',
                  value: '${dashboard.stats.upcomingCount}',
                  icon: Icons.upcoming_rounded,
                  color: const Color(0xFF00BCD4),
                  onTap: () => context.go('/play'),
                ),
              ),
            ],
          ),
        ),

        // ── Upcoming events ──────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
          child: UiSectionTitle(
            'Upcoming Events',
            trailingLabel: 'See all',
            onTrailingTap: () => context.go('/play'),
          ),
        ),
        const SizedBox(height: 12),

        if (dashboard.upcomingEvents.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _NoEventsCard(
              onCreateTap: () => context.push('/sessions/new'),
            ),
          )
        else
          ...dashboard.upcomingEvents.map(
            (event) => Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: _EventCard(event: event),
            ),
          ),

        const SizedBox(height: 24),

        // ── My groups ────────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
          child: UiSectionTitle(
            'My Groups',
            trailingLabel: 'See all',
            onTrailingTap: () => context.go('/groups'),
          ),
        ),
        const SizedBox(height: 12),

        if (dashboard.recentGroups.isNotEmpty)
          SizedBox(
            height: 88,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: dashboard.recentGroups.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (ctx, i) {
                final g = dashboard.recentGroups[i];
                return _DashboardGroupChip(
                  group: g,
                  onTap: () => context.push('/groups/${g.id}'),
                );
              },
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _NoGroupsCard(
              onDiscoverTap: () => context.push('/discover/public-groups'),
            ),
          ),

        const SizedBox(height: 24),

        // ── Quick actions ────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              UiSectionTitle('Quick Actions'),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _ActionTile(
                      icon: Icons.add_circle_rounded,
                      label: 'New Session',
                      color: AppThemeTokens.primary500,
                      onTap: () => context.push('/sessions/new'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ActionTile(
                      icon: Icons.group_add_rounded,
                      label: 'New Group',
                      color: const Color(0xFF7C4DFF),
                      onTap: () => context.push('/groups/new'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ActionTile(
                      icon: Icons.emoji_events_rounded,
                      label: 'Tournaments',
                      color: const Color(0xFFFF9800),
                      onTap: () => context.push('/tournaments'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ActionTile(
                      icon: Icons.sports_soccer_rounded,
                      label: 'Play Hub',
                      color: const Color(0xFF00BCD4),
                      onTap: () => context.go('/play'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 32),
      ],
    );
  }
}

// ── Hero card ─────────────────────────────────────────────────────────────────

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.user, required this.greeting});
  final dynamic user;
  final String greeting;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      decoration: BoxDecoration(
        color: isDark
            ? AppThemeTokens.darkCard.withValues(alpha: 0.94)
            : AppThemeTokens.lightCard.withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color: isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            UserAvatar(
              name: user.name as String,
              imageUrl: user.profilePicture as String?,
              radius: 22,
              borderColor: AppThemeTokens.primary500.withValues(alpha: 0.4),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$greeting 👋',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark
                          ? AppThemeTokens.darkTextSecondary
                          : AppThemeTokens.lightTextSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    user.name as String,
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText,
                      letterSpacing: -0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if ((user.city as String?) != null)
                    Row(
                      children: [
                        const Icon(Icons.place_rounded, size: 11, color: AppThemeTokens.primary400),
                        const SizedBox(width: 3),
                        Text(
                          user.city as String,
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark
                                ? AppThemeTokens.darkTextSecondary
                                : AppThemeTokens.lightTextSecondary,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: isDark
              ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
              : AppThemeTokens.lightCard.withValues(alpha: 0.98),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(
            color: isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
          ),
        ),
        child: Column(
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: color,
                letterSpacing: -0.5,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: isDark
                    ? AppThemeTokens.darkTextSecondary
                    : AppThemeTokens.lightTextSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Action tile ───────────────────────────────────────────────────────────────

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
        decoration: BoxDecoration(
          color: isDark
              ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
              : AppThemeTokens.lightCard.withValues(alpha: 0.98),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(
            color: isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
          ),
        ),
        child: Column(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(height: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Event card ────────────────────────────────────────────────────────────────

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event});
  final DashboardUpcomingEventModel event;

  @override
  Widget build(BuildContext context) {
    final local = event.startTime.toLocal();
    final dayNum = DateFormat('d').format(local);
    final monthAbbr = DateFormat('MMM').format(local).toUpperCase();
    final timeStr = DateFormat.jm().format(local);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: () => context.push(event.destinationPath),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: Container(
          decoration: BoxDecoration(
            color: isDark
                ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
                : AppThemeTokens.lightCard.withValues(alpha: 0.98),
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(
              color: isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
            ),
          ),
          child: Row(
            children: [
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: AppThemeTokens.primary500.withValues(alpha: isDark ? 0.2 : 0.12),
                    borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
                  ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      monthAbbr,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: AppThemeTokens.primary400,
                        height: 1,
                      ),
                    ),
                    Text(
                      dayNum,
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText,
                        height: 1,
                      ),
                    ),
                  ],
                ),
              ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        event.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(
                            Icons.access_time_rounded,
                            size: 12,
                            color: isDark
                                ? AppThemeTokens.darkTextSecondary
                                : AppThemeTokens.lightTextSecondary,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            timeStr,
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? AppThemeTokens.darkTextSecondary
                                  : AppThemeTokens.lightTextSecondary,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Icon(
                            Icons.groups_2_outlined,
                            size: 12,
                            color: isDark
                                ? AppThemeTokens.darkTextSecondary
                                : AppThemeTokens.lightTextSecondary,
                          ),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              event.contextName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark
                                    ? AppThemeTokens.darkTextSecondary
                                    : AppThemeTokens.lightTextSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Icon(
                  Icons.chevron_right_rounded,
                  color: isDark
                      ? AppThemeTokens.darkTextSecondary
                      : AppThemeTokens.lightTextSecondary,
                  size: 20,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── No sessions placeholder ───────────────────────────────────────────────────

class _NoEventsCard extends StatelessWidget {
  const _NoEventsCard({required this.onCreateTap});
  final VoidCallback onCreateTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark
            ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
            : AppThemeTokens.lightCard.withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color: isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppThemeTokens.primary500.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
            ),
            child: const Icon(Icons.event_outlined, size: 22, color: AppThemeTokens.primary400),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No upcoming sessions',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Create a session to get started!',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark
                        ? AppThemeTokens.darkTextSecondary
                        : AppThemeTokens.lightTextSecondary,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onCreateTap,
            child: const Text('Create', style: TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _NoGroupsCard extends StatelessWidget {
  const _NoGroupsCard({required this.onDiscoverTap});
  final VoidCallback onDiscoverTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark
            ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
            : AppThemeTokens.lightCard.withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color: isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppThemeTokens.primary500.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
            ),
            child: const Icon(Icons.groups_outlined, size: 22, color: AppThemeTokens.primary400),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No groups yet',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Discover groups and join your first one.',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark
                        ? AppThemeTokens.darkTextSecondary
                        : AppThemeTokens.lightTextSecondary,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onDiscoverTap,
            child: const Text('Discover', style: TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

// ── Group chip (typed for DashboardGroupModel) ────────────────────────────────

class _DashboardGroupChip extends StatelessWidget {
  const _DashboardGroupChip({required this.group, required this.onTap});
  final DashboardGroupModel group;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 76,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            UserAvatar(
              name: group.name,
              imageUrl: group.profilePicture,
              radius: 26,
            ),
            const SizedBox(height: 6),
            Text(
              group.name,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText,
                height: 1.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
