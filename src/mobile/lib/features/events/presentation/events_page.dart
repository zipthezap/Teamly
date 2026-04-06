import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/mobile_shell.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../state/events_notifier.dart';

class EventsPage extends ConsumerWidget {
  const EventsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(eventsNotifierProvider);
    final theme = Theme.of(context);

    return MobileShell(
      title: 'Events',
      currentIndex: 2,
      child: Stack(
        children: [
          eventsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => ErrorDisplay(
              message: e.toString(),
              onRetry: () => ref.read(eventsNotifierProvider.notifier).load(),
            ),
            data: (events) {
              if (events.isEmpty) {
                return const UiEmptyState(
                  icon: Icons.event_outlined,
                  message: 'No upcoming events.\nCreate one to get started!',
                );
              }

              return RefreshIndicator(
                onRefresh: () => ref.read(eventsNotifierProvider.notifier).load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 80),
                  itemCount: events.length,
                  itemBuilder: (context, index) {
                    final event = events[index];
                    final local = event.startTime.toLocal();
                    final dayNum = DateFormat('d').format(local);
                    final monthAbbr = DateFormat('MMM').format(local).toUpperCase();
                    final timeStr = DateFormat.jm().format(local);
                    final isPast = event.startTime.isBefore(DateTime.now());

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Card(
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () => context.push('/events/${event.id}'),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            child: Row(
                              children: [
                                // Date badge
                                Container(
                                  width: 48,
                                  height: 54,
                                  decoration: BoxDecoration(
                                    color: isPast
                                        ? AppThemeTokens.darkCardHover
                                        : theme.colorScheme.primary.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
                                  ),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        monthAbbr,
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                          color: isPast
                                              ? AppThemeTokens.darkTextSecondary
                                              : theme.colorScheme.primary,
                                        ),
                                      ),
                                      Text(
                                        dayNum,
                                        style: TextStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.bold,
                                          height: 1.1,
                                          color: isPast
                                              ? AppThemeTokens.darkTextSecondary
                                              : theme.colorScheme.primary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                // Content
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        event.title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: theme.textTheme.titleSmall?.copyWith(
                                          color: isPast
                                              ? AppThemeTokens.darkTextSecondary
                                              : AppThemeTokens.darkText,
                                        ),
                                      ),
                                      const SizedBox(height: 3),
                                      Row(
                                        children: [
                                          const Icon(
                                            Icons.access_time_outlined,
                                            size: 12,
                                            color: AppThemeTokens.darkTextSecondary,
                                          ),
                                          const SizedBox(width: 3),
                                          Text(
                                            timeStr,
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: AppThemeTokens.darkTextSecondary,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          const Icon(
                                            Icons.group_outlined,
                                            size: 12,
                                            color: AppThemeTokens.darkTextSecondary,
                                          ),
                                          const SizedBox(width: 3),
                                          Expanded(
                                            child: Text(
                                              event.group.name,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontSize: 12,
                                                color: AppThemeTokens.darkTextSecondary,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (event.eventType != null) ...[
                                        const SizedBox(height: 4),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppThemeTokens.darkCardHover,
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(
                                            event.eventType!,
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: AppThemeTokens.darkTextSecondary,
                                            ),
                                          ),
                                        ),
                                      ],
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
                      ),
                    );
                  },
                ),
              );
            },
          ),
          // FAB
          Positioned(
            bottom: 16,
            right: 16,
            child: FloatingActionButton(
              onPressed: () => context.push('/events/new'),
              tooltip: 'Create event',
              child: const Icon(Icons.add),
            ),
          ),
        ],
      ),
    );
  }
}
