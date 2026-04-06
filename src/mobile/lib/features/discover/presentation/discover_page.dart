import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

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
          Text('Find new opportunities', style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey)),
          const SizedBox(height: 16),
          _DiscoverCard(
            icon: Icons.explore_outlined,
            title: 'Public Groups',
            subtitle: 'Find and join groups near you',
            color: Colors.blue.shade700,
            onTap: () => context.push('/discover/public-groups'),
          ),
          const SizedBox(height: 12),
          _DiscoverCard(
            icon: Icons.handshake_outlined,
            title: 'TeamUp',
            subtitle: 'Find players or join a team',
            color: Colors.purple.shade700,
            onTap: () => context.push('/teamup'),
          ),
          const SizedBox(height: 12),
          _DiscoverCard(
            icon: Icons.emoji_events_outlined,
            title: 'Tournaments',
            subtitle: 'Browse and compete in tournaments',
            color: Colors.orange.shade700,
            onTap: () => context.push('/tournaments'),
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
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
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
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color, size: 28),
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
                          ?.copyWith(color: Colors.grey),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }
}
