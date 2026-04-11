import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../features/auth/state/auth_notifier.dart';
import '../../../features/sessions/state/sessions_notifier.dart';
import '../../../features/groups/state/groups_notifier.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';

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
    final groupsAsync = ref.watch(groupsNotifierProvider);
    final eventsAsync = ref.watch(eventsNotifierProvider);
    final theme = Theme.of(context);

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
        onRefresh: () async {
          await Future.wait([
            ref.read(groupsNotifierProvider.notifier).reload(),
            ref.read(eventsNotifierProvider.notifier).reload(),
          ]);
        },
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            // ── Hero welcome card ──────────────────────────────────────────
            if (user != null) _HeroCard(user: user, greeting: _greeting()),

            // ── Stat pills ─────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Row(
                children: [
                  Expanded(
                    child: _StatPill(
                      label: 'Groups',
                      value: groupsAsync.maybeWhen(
                        data: (g) => '${g.length}',
                        orElse: () => '—',
                      ),
                      icon: Icons.groups_2_rounded,
                      color: AppThemeTokens.primary500,
                      onTap: () => context.go('/groups'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatPill(
                      label: 'Events',
                      value: eventsAsync.maybeWhen(
                        data: (e) => '${e.length}',
                        orElse: () => '—',
                      ),
                      icon: Icons.event_rounded,
                      color: const Color(0xFF7C4DFF),
                      onTap: () => context.go('/sessions'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatPill(
                      label: 'Upcoming',
                      value: eventsAsync.maybeWhen(
                        data: (e) => '${e.where((ev) => ev.startTime.isAfter(DateTime.now())).length}',
                        orElse: () => '—',
                      ),
                      icon: Icons.upcoming_rounded,
                      color: const Color(0xFF00BCD4),
                      onTap: () => context.go('/sessions'),
                    ),
                  ),
                ],
              ),
            ),

            // ── Upcoming events ────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
              child: UiSectionTitle(
                'Upcoming Events',
                trailingLabel: 'See all',
                onTrailingTap: () => context.go('/sessions'),
              ),
            ),
            const SizedBox(height: 12),

            eventsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => ErrorDisplay(message: e.toString()),
              data: (events) {
                final upcoming = events
                    .where((e) => e.startTime.isAfter(DateTime.now()))
                    .take(5)
                    .toList();

                if (upcoming.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _NoEventsCard(
                      onCreateTap: () => context.push('/events/new'),
                    ),
                  );
                }

                return Column(
                  children: upcoming.map((event) {
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                      child: _EventCard(event: event),
                    );
                  }).toList(),
                );
              },
            ),

            const SizedBox(height: 24),

            // ── My groups ──────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: UiSectionTitle(
                'My Groups',
                trailingLabel: 'See all',
                onTrailingTap: () => context.go('/groups'),
              ),
            ),
            const SizedBox(height: 12),

            groupsAsync.when(
              loading: () => const SizedBox(height: 40),
              error: (_, __) => const SizedBox.shrink(),
              data: (groups) {
                if (groups.isEmpty) return const SizedBox.shrink();
                return SizedBox(
                  height: 88,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: groups.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (ctx, i) => _GroupChip(
                      group: groups[i],
                      onTap: () => context.push('/groups/${groups[i].id}'),
                    ),
                  ),
                );
              },
            ),

            const SizedBox(height: 24),

            // ── Quick actions ──────────────────────────────────────────────
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
                          label: 'New Event',
                          color: AppThemeTokens.primary500,
                          onTap: () => context.push('/events/new'),
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
                          icon: Icons.explore_rounded,
                          label: 'Discover',
                          color: const Color(0xFF00BCD4),
                          onTap: () => context.go('/discover'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
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
  final dynamic event;

  @override
  Widget build(BuildContext context) {
    final local = (event.startTime as DateTime).toLocal();
    final dayNum = DateFormat('d').format(local);
    final monthAbbr = DateFormat('MMM').format(local).toUpperCase();
    final timeStr = DateFormat.jm().format(local);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: () => context.push('/events/${event.id}'),
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
                        event.title as String,
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
                              event.group.name as String,
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

// ── No events placeholder ─────────────────────────────────────────────────────

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
                  'No upcoming events',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Create one to get started!',
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

// ── Group chip ────────────────────────────────────────────────────────────────

class _GroupChip extends StatelessWidget {
  const _GroupChip({required this.group, required this.onTap});
  final dynamic group;
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
              name: group.name as String,
              imageUrl: group.profilePicture as String?,
              radius: 26,
            ),
            const SizedBox(height: 6),
            Text(
              group.name as String,
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
