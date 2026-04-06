import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/mobile_shell.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  void _onTab(BuildContext context, int index) {
    if (index == 0) context.go('/dashboard');
    if (index == 1) context.go('/groups');
    if (index == 2) context.go('/events');
  }

  @override
  Widget build(BuildContext context) {
    return MobileShell(
      title: 'Dashboard',
      currentIndex: 0,
      onTabSelected: (i) => _onTab(context, i),
      child: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Dashboard read model shell (MVP phase).'),
        ),
      ),
    );
  }
}
