import 'package:flutter/material.dart';

import '../../../shared/widgets/mobile_shell.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const MobileShell(
      title: 'Dashboard',
      currentIndex: 0,
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Dashboard read model shell (MVP phase).'),
        ),
      ),
    );
  }
}
