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
                              'Welcome back,',
                              style: theme.textTheme.bodySmall?.copyWith(color: AppThemeTokens.darkTextSecondary),
                            ),
                            Text(
                              user.name,
                              style: theme.textTheme.titleLarge,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (user.city != null)
                              Text(
                                user.city!,
                                style: theme.textTheme.bodySmall?.copyWith(color: AppThemeTokens.darkTextSecondary),
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

            // Upcoming events
            const UiSectionTitle('Upcoming Events'),
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
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Text(
                      'No upcoming events.',
                      style: TextStyle(color: AppThemeTokens.darkTextSecondary),
                    ),
                  );
                }

                return Column(
                  children: upcoming
                      .map(
                        (event) => Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: theme.colorScheme.primaryContainer,
                              child: Text(
                                DateFormat('d').format(event.startTime.toLocal()),
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: theme.colorScheme.onPrimaryContainer,
                                ),
                              ),
                            ),
                            title: Text(
                              event.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(
                              '${event.group.name} · ${DateFormat.jm().format(event.startTime.toLocal())}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => context.push('/events/${event.id}'),
                          ),
                        ).clipRRect(all: AppThemeTokens.radiusMd),
                      )
                      .toList(),
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
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Icon(icon, size: 32, color: theme.colorScheme.primary),
              const SizedBox(height: 8),
              Text(
                value,
                style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              Text(label, style: theme.textTheme.bodySmall?.copyWith(color: AppThemeTokens.darkTextSecondary)),
            ],
          ),
        ),
      ),
    );
  }
}
