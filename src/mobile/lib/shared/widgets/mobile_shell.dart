import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../features/notifications/state/notifications_notifier.dart';
import 'teamly_logo.dart';

class MobileShell extends ConsumerWidget {
  const MobileShell({
    super.key,
    required this.title,
    required this.currentIndex,
    required this.child,
    this.actions,
    this.titleWidget,
    this.floatingActionButton,
    this.leading,
  });

  final String title;
  final int currentIndex;
  final Widget child;
  final List<Widget>? actions;
  final Widget? titleWidget;
  final Widget? floatingActionButton;
  final Widget? leading;

  static void navigateByTab(BuildContext context, int index) {
    switch (index) {
      case 0:
        context.go('/dashboard');
        return;
      case 1:
        context.go('/groups');
        return;
      case 2:
        context.go('/sessions');
        return;
      case 3:
        context.go('/discover');
        return;
      default:
        return;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadAsync = ref.watch(unreadCountProvider);
    final unreadCount = unreadAsync.maybeWhen(data: (c) => c, orElse: () => 0);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final navBarColor = isDark ? AppThemeTokens.darkCard : AppThemeTokens.lightCard;

    SystemChrome.setSystemUIOverlayStyle(
      (isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark).copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: navBarColor,
      ),
    );

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        leading: leading,
        automaticallyImplyLeading: true,
        title: titleWidget ??
            (title == 'Teamly'
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const TeamlyLogo(size: 26),
                      const SizedBox(width: 8),
                      Text(
                        'Teamly',
                        style: Theme.of(context).appBarTheme.titleTextStyle ??
                            const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                            ),
                      ),
                    ],
                  )
                : Text(title)),
        actions: [
          _NotificationIconButton(unreadCount: unreadCount, onTap: () => context.push('/notifications')),
          if (actions != null) ...actions!,
          const SizedBox(width: 4),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            height: 1,
            color: Theme.of(context).dividerColor.withValues(alpha: 0.6),
          ),
        ),
      ),
      body: child,
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: _BottomNav(
        currentIndex: currentIndex,
        onTap: (i) => navigateByTab(context, i),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          top: BorderSide(color: Theme.of(context).dividerColor, width: 1),
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
                label: 'Sessions',
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
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
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
                    : Theme.of(context).textTheme.bodySmall?.color ??
                        AppThemeTokens.darkTextSecondary,
              ),
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
                    : Theme.of(context).textTheme.bodySmall?.color ??
                        AppThemeTokens.darkTextSecondary,
              ),
              child: Text(label),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationIconButton extends StatelessWidget {
  const _NotificationIconButton({
    required this.unreadCount,
    required this.onTap,
  });

  final int unreadCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Notifications',
      onPressed: onTap,
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(Icons.notifications_outlined),
          if (unreadCount > 0)
            Positioned(
              right: -6,
              top: -6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: AppThemeTokens.error,
                  borderRadius: BorderRadius.circular(100),
                  border: Border.all(
                    color: Theme.of(context).colorScheme.surface,
                    width: 1.5,
                  ),
                ),
                child: Text(
                  unreadCount > 99 ? '99+' : '$unreadCount',
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
    );
  }
}
