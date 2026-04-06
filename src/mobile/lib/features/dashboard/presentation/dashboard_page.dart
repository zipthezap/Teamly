import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:styled_widget/styled_widget.dart';

import '../../../features/auth/state/auth_notifier.dart';
import '../../../features/events/state/events_notifier.dart';
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
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final groupsAsync = ref.watch(groupsNotifierProvider);
    final eventsAsync = ref.watch(eventsNotifierProvider);
    final theme = Theme.of(context);

    final user = authState.user;

    return MobileShell(
      title: 'Dashboard',
      currentIndex: 0,
      actions: [
        IconButton(
          icon: const Icon(Icons.person_outline),
          onPressed: () => context.push('/profile'),
        ),
      ],
      child: RefreshIndicator(
        onRefresh: () async {
          await Future.wait([
            ref.read(groupsNotifierProvider.notifier).load(),
            ref.read(eventsNotifierProvider.notifier).load(),
          ]);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Welcome card
            if (user != null)
              Card(
                margin: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      UserAvatar(
                        name: user.name,
                        imageUrl: user.profilePicture,
                        radius: 28,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _greeting(),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: AppThemeTokens.darkTextSecondary,
                              ),
                            ),
                            Text(
                              user.name,
                              style: theme.textTheme.titleLarge,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (user.city != null)
                              Row(
                                children: [
                                  const Icon(
                                    Icons.place_outlined,
                                    size: 12,
                                    color: AppThemeTokens.darkTextSecondary,
                                  ),
                                  const SizedBox(width: 3),
                                  Text(
                                    user.city!,
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: AppThemeTokens.darkTextSecondary,
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
              ),

            const SizedBox(height: 16),

            // Stats row
            Row(
              children: [
                Expanded(
                  child: _StatCard(
                    label: 'Groups',
                    value: groupsAsync.maybeWhen(
                      data: (g) => '${g.length}',
                      orElse: () => '—',
                    ),
                    icon: Icons.group_outlined,
                    onTap: () => context.go('/groups'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    label: 'Events',
                    value: eventsAsync.maybeWhen(
                      data: (e) => '${e.length}',
                      orElse: () => '—',
                    ),
                    icon: Icons.event_outlined,
                    onTap: () => context.go('/events'),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Quick actions
            const UiSectionTitle('Quick Actions'),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _QuickActionButton(
                    icon: Icons.add_circle_outline,
                    label: 'New Event',
                    onTap: () => context.push('/events/new'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _QuickActionButton(
                    icon: Icons.group_add_outlined,
                    label: 'New Group',
                    onTap: () => context.push('/groups/new'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _QuickActionButton(
                    icon: Icons.explore_outlined,
                    label: 'Discover',
                    onTap: () => context.go('/discover'),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Upcoming events
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const UiSectionTitle('Upcoming Events'),
                TextButton(
                  onPressed: () => context.go('/events'),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('See all'),
                ),
              ],
            ),
            const SizedBox(height: 8),

            eventsAsync.when(
              loading: () => const Center(child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(),
              )),
              error: (e, _) => ErrorDisplay(message: e.toString()),
              data: (events) {
                final upcoming = events
                    .where((e) => e.startTime.isAfter(DateTime.now()))
                    .take(5)
                    .toList();

                if (upcoming.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.event_outlined,
                          size: 20,
                          color: AppThemeTokens.darkTextSecondary,
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'No upcoming events.',
                          style: TextStyle(color: AppThemeTokens.darkTextSecondary),
                        ),
                        const Spacer(),
                        TextButton(
                          onPressed: () => context.push('/events/new'),
                          child: const Text('Create one'),
                        ),
                      ],
                    ),
                  );
                }

                return Column(
                  children: upcoming.map((event) {
                    final local = event.startTime.toLocal();
                    final dayNum = DateFormat('d').format(local);
                    final monthAbbr = DateFormat('MMM').format(local).toUpperCase();
                    final timeStr = DateFormat.jm().format(local);

                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: () => context.push('/events/${event.id}'),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          child: Row(
                            children: [
                              Container(
                                width: 42,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: theme.colorScheme.primary.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      monthAbbr,
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w600,
                                        color: theme.colorScheme.primary,
                                      ),
                                    ),
                                    Text(
                                      dayNum,
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        height: 1.1,
                                        color: theme.colorScheme.primary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      event.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: theme.textTheme.titleSmall,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${event.group.name} · $timeStr',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppThemeTokens.darkTextSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right,
                                color: AppThemeTokens.darkTextSecondary,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ).clipRRect(all: AppThemeTokens.radiusMd);
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Card(
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Icon(icon, size: 28, color: theme.colorScheme.primary),
                const SizedBox(height: 6),
                Text(
                  value,
                  style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
                ),
                Text(
                  label,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppThemeTokens.darkTextSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          child: Column(
            children: [
              Icon(icon, size: 22, color: theme.colorScheme.primary),
              const SizedBox(height: 4),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppThemeTokens.darkTextSecondary,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
