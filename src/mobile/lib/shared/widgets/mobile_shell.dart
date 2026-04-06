import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class MobileShell extends StatelessWidget {
  const MobileShell({
    super.key,
    required this.title,
    required this.currentIndex,
    required this.child,
    this.actions,
  });

  final String title;
  final int currentIndex;
  final Widget child;
  final List<Widget>? actions;

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
      default:
        return;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (i) => navigateByTab(context, i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.groups_outlined), label: 'Groups'),
          NavigationDestination(icon: Icon(Icons.event_outlined), label: 'Events'),
        ],
      ),
    );
  }
}
