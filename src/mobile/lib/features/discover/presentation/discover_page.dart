import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/mobile_shell.dart';

class DiscoverPage extends StatelessWidget {
  const DiscoverPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return MobileShell(
      title: 'Discover',
      currentIndex: 3,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Find new opportunities',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppThemeTokens.darkTextSecondary,
            ),
          ),
          const SizedBox(height: 16),
          _DiscoverCard(
            icon: Icons.explore_outlined,
            title: 'Public Groups',
            subtitle: 'Find and join groups near you',
            iconColor: AppThemeTokens.primary500,
            onTap: () => context.push('/discover/public-groups'),
          ),
          const SizedBox(height: 12),
          _DiscoverCard(
            icon: Icons.handshake_outlined,
            title: 'TeamUp',
            subtitle: 'Find players or join a team',
            iconColor: const Color(0xFF9C27B0),
            onTap: () => context.push('/teamup'),
          ),
          const SizedBox(height: 12),
          _DiscoverCard(
            icon: Icons.emoji_events_outlined,
            title: 'Tournaments',
            subtitle: 'Browse and compete in tournaments',
            iconColor: const Color(0xFFFF9800),
            onTap: () => context.push('/tournaments'),
          ),
          const SizedBox(height: 12),
          _DiscoverCard(
            icon: Icons.near_me_outlined,
            title: 'Nearby Groups',
            subtitle: 'Find groups close to your location',
            iconColor: const Color(0xFF009688),
            onTap: () => context.push('/discover/nearby-groups'),
          ),
          const SizedBox(height: 12),
          _DiscoverCard(
            icon: Icons.bar_chart_outlined,
            title: 'My Event Statistics',
            subtitle: 'Track your event participation stats',
            iconColor: const Color(0xFF3F51B5),
            onTap: () => context.push('/discover/event-statistics'),
          ),
        ],
      ),
    );
  }
}

class _DiscoverCard extends StatelessWidget {
  const _DiscoverCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.iconColor,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color iconColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: iconColor, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppThemeTokens.darkTextSecondary),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppThemeTokens.darkTextSecondary),
            ],
          ),
        ),
      ),
    );
  }
}
