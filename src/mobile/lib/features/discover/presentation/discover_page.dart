import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/mobile_shell.dart';

class DiscoverPage extends StatelessWidget {
  const DiscoverPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText;
    final secondaryColor = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;
    final heroBannerGradient = isDark ? AppThemeTokens.heroGradient : AppThemeTokens.lightHeroGradient;
    final heroBorderColor = isDark
        ? AppThemeTokens.primary500.withValues(alpha: 0.2)
        : AppThemeTokens.primary500.withValues(alpha: 0.3);

    return MobileShell(
      title: 'Discover',
      currentIndex: 3,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          // Header banner
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: heroBannerGradient,
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusLg),
              border: Border.all(color: heroBorderColor),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppThemeTokens.primary500.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                  ),
                  child: const Icon(
                    Icons.explore_rounded,
                    color: AppThemeTokens.primary400,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Find your community',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: textColor,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Explore groups, sessions & players',
                        style: TextStyle(
                          fontSize: 12,
                          color: secondaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _SectionHeading('Browse'),
          const SizedBox(height: 10),
          _DiscoverCard(
            icon: Icons.explore_rounded,
            title: 'Public Groups',
            subtitle: 'Find and join groups near you',
            iconColor: AppThemeTokens.primary500,
            onTap: () => context.push('/discover/public-groups'),
          ),
          const SizedBox(height: 10),
          _DiscoverCard(
            icon: Icons.near_me_rounded,
            title: 'Nearby Groups',
            subtitle: 'Find groups close to your location',
            iconColor: const Color(0xFF009688),
            onTap: () => context.push('/discover/nearby-groups'),
          ),
          const SizedBox(height: 10),
          _DiscoverCard(
            icon: Icons.event_note_rounded,
            title: 'Nearby Sessions',
            subtitle: 'Discover sessions close to your location',
            iconColor: const Color(0xFF00BCD4),
            onTap: () => context.push('/discover/nearby-sessions'),
          ),
          const SizedBox(height: 20),
          _SectionHeading('Compete'),
          const SizedBox(height: 10),
          _DiscoverCard(
            icon: Icons.emoji_events_rounded,
            title: 'Tournaments',
            subtitle: 'Browse and compete in tournaments',
            iconColor: const Color(0xFFFF9800),
            onTap: () => context.push('/tournaments'),
          ),
          const SizedBox(height: 10),
          _DiscoverCard(
            icon: Icons.military_tech_rounded,
            title: 'Leagues',
            subtitle: 'Join and manage recurring league competitions',
            iconColor: const Color(0xFF8B5CF6),
            onTap: () => context.push('/leagues'),
          ),
          const SizedBox(height: 10),
          _DiscoverCard(
            icon: Icons.handshake_rounded,
            title: 'TeamUp',
            subtitle: 'Find players or join a team',
            iconColor: const Color(0xFF7C4DFF),
            onTap: () => context.push('/teamup'),
          ),
          const SizedBox(height: 20),
          _SectionHeading('Insights'),
          const SizedBox(height: 10),
          _DiscoverCard(
            icon: Icons.bar_chart_rounded,
            title: 'My Session Statistics',
            subtitle: 'Track your session participation stats',
            iconColor: const Color(0xFF3F51B5),
            onTap: () => context.push('/discover/session-statistics'),
          ),
        ],
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(left: 2),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary,
          letterSpacing: 1.2,
        ),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;
    final borderColor = isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    final titleColor = isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText;
    final subtitleColor = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;
    final arrowColor = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: Container(
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(color: borderColor),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                    border: Border.all(color: iconColor.withValues(alpha: 0.2)),
                  ),
                  child: Icon(icon, color: iconColor, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: titleColor,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 12,
                          color: subtitleColor,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  color: arrowColor,
                  size: 14,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
