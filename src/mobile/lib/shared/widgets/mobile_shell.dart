import 'package:flutter/material.dart';

class MobileShell extends StatelessWidget {
  const MobileShell({
    super.key,
    required this.title,
    required this.currentIndex,
    required this.child,
    required this.onTabSelected,
  });

  final String title;
  final int currentIndex;
  final Widget child;
  final ValueChanged<int> onTabSelected;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: onTabSelected,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.groups_outlined), label: 'Groups'),
          NavigationDestination(icon: Icon(Icons.event_outlined), label: 'Events'),
        ],
      ),
    );
  }
}
