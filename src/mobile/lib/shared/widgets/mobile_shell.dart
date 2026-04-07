import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../features/notifications/state/notifications_notifier.dart';

class MobileShell extends ConsumerWidget {
  const MobileShell({
    super.key,
    required this.title,
    required this.currentIndex,
    required this.child,
    this.actions,
    this.titleWidget,
  });

  final String title;
  final int currentIndex;
  final Widget child;
  final List<Widget>? actions;
  final Widget? titleWidget;

  static void navigateByTab(BuildContext context, int index) {
    switch (index) {
      case 0:
        context.go('/dashboard');
        return;
      case 1:
        context.go('/groups');
        return;
      case 2:
        context.go('/events');
        return;
      case 3:
        context.go('/discover');
        return;
      case 4:
        context.go('/notifications');
        return;
      default:
        return;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadAsync = ref.watch(unreadCountProvider);
    final unreadCount = unreadAsync.maybeWhen(data: (c) => c, orElse: () => 0);

    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light.copyWith(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: AppThemeTokens.darkCard,
    ));

    return Scaffold(
      backgroundColor: AppThemeTokens.darkBg,
      appBar: AppBar(
        title: titleWidget ?? Text(title),
        actions: [
          if (actions != null) ...actions!,
          const SizedBox(width: 4),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            height: 1,
            color: AppThemeTokens.darkBorder.withValues(alpha: 0.6),
          ),
        ),
      ),
      body: child,
      bottomNavigationBar: _BottomNav(
        currentIndex: currentIndex,
        unreadCount: unreadCount,
        onTap: (i) => navigateByTab(context, i),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({
    required this.currentIndex,
    required this.unreadCount,
    required this.onTap,
  });

  final int currentIndex;
  final int unreadCount;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCard,
        border: const Border(
          top: BorderSide(color: AppThemeTokens.darkBorder, width: 1),
        ),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 60,
          child: Row(
            children: [
              _NavItem(
                icon: Icons.dashboard_outlined,
                selectedIcon: Icons.dashboard_rounded,
                label: 'Home',
                selected: currentIndex == 0,
                onTap: () => onTap(0),
              ),
              _NavItem(
                icon: Icons.groups_2_outlined,
                selectedIcon: Icons.groups_2_rounded,
                label: 'Groups',
                selected: currentIndex == 1,
                onTap: () => onTap(1),
              ),
              _NavItem(
                icon: Icons.event_outlined,
                selectedIcon: Icons.event_rounded,
                label: 'Events',
                selected: currentIndex == 2,
                onTap: () => onTap(2),
              ),
              _NavItem(
                icon: Icons.explore_outlined,
                selectedIcon: Icons.explore_rounded,
                label: 'Discover',
                selected: currentIndex == 3,
                onTap: () => onTap(3),
              ),
              _NavItem(
                icon: Icons.notifications_outlined,
                selectedIcon: Icons.notifications_rounded,
                label: 'Alerts',
                selected: currentIndex == 4,
                badge: unreadCount > 0 ? '$unreadCount' : null,
                onTap: () => onTap(4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeInOut,
                  width: selected ? 44 : 36,
                  height: 30,
                  decoration: selected
                      ? BoxDecoration(
                          color: AppThemeTokens.primaryGlow,
                          borderRadius: BorderRadius.circular(100),
                        )
                      : null,
                  child: Icon(
                    selected ? selectedIcon : icon,
                    size: 22,
                    color: selected
                        ? AppThemeTokens.primary400
                        : AppThemeTokens.darkTextSecondary,
                  ),
                ),
                if (badge != null)
                  Positioned(
                    top: -4,
                    right: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: AppThemeTokens.error,
                        borderRadius: BorderRadius.circular(100),
                        border: Border.all(
                          color: AppThemeTokens.darkCard,
                          width: 1.5,
                        ),
                      ),
                      child: Text(
                        badge!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 10,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected
                    ? AppThemeTokens.primary400
                    : AppThemeTokens.darkTextSecondary,
              ),
              child: Text(label),
            ),
          ],
        ),
      ),
    );
  }
}
