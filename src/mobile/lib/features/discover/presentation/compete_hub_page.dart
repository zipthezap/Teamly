import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/mobile_shell.dart';

class CompeteHubPage extends StatelessWidget {
  const CompeteHubPage({super.key});

  @override
  Widget build(BuildContext context) {
    return MobileShell(
      title: 'Compete',
      currentIndex: 3,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          _HubHeader(
            icon: Icons.emoji_events_rounded,
            title: 'Competition hub',
            subtitle: 'Organized competition and long-term play',
          ),
          const SizedBox(height: 20),
          const _SectionHeading('Core'),
          const SizedBox(height: 10),
          _HubCard(
            icon: Icons.emoji_events_rounded,
            title: 'Tournaments',
            subtitle: 'Browse, join, and manage tournaments',
            iconColor: const Color(0xFFFF9800),
            onTap: () => context.go('/tournaments'),
          ),
          const SizedBox(height: 10),
          _HubCard(
            icon: Icons.military_tech_rounded,
            title: 'Leagues',
            subtitle: 'Recurring competitions and standings',
            iconColor: const Color(0xFF8B5CF6),
            onTap: () => context.push('/leagues'),
          ),
          const SizedBox(height: 20),
          const _SectionHeading('Explore'),
          const SizedBox(height: 10),
          _HubCard(
            icon: Icons.public_rounded,
            title: 'Public Tournaments',
            subtitle: 'Discover open tournaments in your area',
            iconColor: const Color(0xFF2196F3),
            onTap: () => context.push('/discover-tournaments'),
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
          color: isDark
              ? AppThemeTokens.darkTextSecondary
              : AppThemeTokens.lightTextSecondary,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

class _HubHeader extends StatelessWidget {
  const _HubHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: AppThemeTokens.heroGrad(context),
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusLg),
        border: Border.all(
          color: isDark
              ? const Color(0xFFFF9800).withValues(alpha: 0.25)
              : const Color(0xFFFF9800).withValues(alpha: 0.35),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFF9800).withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            ),
            child: const Icon(
              Icons.emoji_events_rounded,
              color: Color(0xFFFF9800),
              size: 28,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppThemeTokens.text(context),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppThemeTokens.textSecondary(context),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HubCard extends StatelessWidget {
  const _HubCard({
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
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppThemeTokens.card(context),
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            border: Border.all(color: AppThemeTokens.border(context)),
          ),
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
                        color: AppThemeTokens.text(context),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: AppThemeTokens.textSecondary(context),
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                color: AppThemeTokens.textSecondary(context),
                size: 14,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
