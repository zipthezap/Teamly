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

    return MobileShell(
      title: 'Events',
      currentIndex: 2,
      actions: [
        IconButton(
          icon: const Icon(Icons.ios_share_outlined),
          tooltip: 'Export events',
          onPressed: () {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Export Events'),
                content: const Text('To export your events as CSV, please use the web app in your browser.'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('OK'),
                  ),
                ],
              ),
            );
          },
        ),
      ],
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
                  title: 'No events yet',
                  message: 'Create your first event\nto get started!',
                );
              }

              // Split into upcoming and past
              final now = DateTime.now();
              final upcoming = events.where((e) => e.startTime.isAfter(now)).toList();
              final past = events.where((e) => !e.startTime.isAfter(now)).toList();

              return RefreshIndicator(
                onRefresh: () => ref.read(eventsNotifierProvider.notifier).load(),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
                  children: [
                    if (upcoming.isNotEmpty) ...[
                      const UiSectionTitle('Upcoming'),
                      const SizedBox(height: 10),
                      ...upcoming.map((e) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _EventListCard(event: e, isPast: false),
                      )),
                    ],
                    if (past.isNotEmpty) ...[
                      if (upcoming.isNotEmpty) const SizedBox(height: 8),
                      const UiSectionTitle('Past'),
                      const SizedBox(height: 10),
                      ...past.map((e) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _EventListCard(event: e, isPast: true),
                      )),
                    ],
                  ],
                ),
              );
            },
          ),
          Positioned(
            bottom: 20,
            right: 20,
            child: FloatingActionButton.extended(
              onPressed: () => context.push('/events/new'),
              icon: const Icon(Icons.add_rounded),
              label: const Text('New Event', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

class _EventListCard extends StatelessWidget {
  const _EventListCard({required this.event, required this.isPast});
  final dynamic event;
  final bool isPast;

  // Color accent per event type
  Color _accentColor() {
    switch ((event.eventType as String?)?.toLowerCase()) {
      case 'match':
      case 'game':
        return AppThemeTokens.primary500;
      case 'training':
      case 'practice':
        return const Color(0xFF4CAF50);
      case 'tournament':
        return const Color(0xFFFF9800);
      case 'social':
        return const Color(0xFF7C4DFF);
      default:
        return AppThemeTokens.primary500;
    }
  }

  @override
  Widget build(BuildContext context) {
    final local = (event.startTime as DateTime).toLocal();
    final dayNum = DateFormat('d').format(local);
    final monthAbbr = DateFormat('MMM').format(local).toUpperCase();
    final weekday = DateFormat('EEE').format(local);
    final timeStr = DateFormat.jm().format(local);
    final accent = isPast ? AppThemeTokens.darkTextSecondary : _accentColor();

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: () => context.push('/events/${event.id}'),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: Opacity(
          opacity: isPast ? 0.6 : 1.0,
          child: Container(
            decoration: BoxDecoration(
              color: AppThemeTokens.darkCard,
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
              border: Border.all(color: AppThemeTokens.darkBorder),
            ),
            child: IntrinsicHeight(
              child: Row(
                children: [
                  // Colored left accent bar
                  Container(
                    width: 4,
                    decoration: BoxDecoration(
                      color: accent,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(AppThemeTokens.radiusMd),
                        bottomLeft: Radius.circular(AppThemeTokens.radiusMd),
                      ),
                    ),
                  ),
                  // Date
                  Container(
                    width: 52,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          weekday,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: isPast ? AppThemeTokens.darkTextMuted : accent,
                            letterSpacing: 0.5,
                          ),
                        ),
                        Text(
                          dayNum,
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: isPast ? AppThemeTokens.darkTextSecondary : accent,
                            height: 1.1,
                          ),
                        ),
                        Text(
                          monthAbbr,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: isPast ? AppThemeTokens.darkTextMuted : accent,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 1,
                    color: AppThemeTokens.darkBorder,
                    margin: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  const SizedBox(width: 14),
                  // Content
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  event.title as String,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                    color: AppThemeTokens.darkText,
                                  ),
                                ),
                              ),
                              if (event.eventType != null)
                                Container(
                                  margin: const EdgeInsets.only(left: 8),
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: accent.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(100),
                                  ),
                                  child: Text(
                                    event.eventType as String,
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: accent,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 5),
                          Row(
                            children: [
                              Icon(Icons.access_time_rounded, size: 12, color: AppThemeTokens.darkTextSecondary.withValues(alpha: 0.7)),
                              const SizedBox(width: 3),
                              Text(
                                timeStr,
                                style: const TextStyle(fontSize: 12, color: AppThemeTokens.darkTextSecondary),
                              ),
                              const SizedBox(width: 10),
                              Icon(Icons.groups_2_outlined, size: 12, color: AppThemeTokens.darkTextSecondary.withValues(alpha: 0.7)),
                              const SizedBox(width: 3),
                              Expanded(
                                child: Text(
                                  event.group.name as String,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 12, color: AppThemeTokens.darkTextSecondary),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.only(right: 12),
                    child: Icon(Icons.chevron_right_rounded, color: AppThemeTokens.darkTextSecondary, size: 20),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
