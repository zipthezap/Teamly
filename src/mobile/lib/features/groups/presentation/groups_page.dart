import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/mobile_shell.dart';

class GroupsPage extends StatelessWidget {
  const GroupsPage({super.key});

  void _onTab(BuildContext context, int index) {
    if (index == 0) context.go('/dashboard');
    if (index == 1) context.go('/groups');
    if (index == 2) context.go('/events');
  }

  @override
  Widget build(BuildContext context) {
    return MobileShell(
      title: 'Groups',
      currentIndex: 1,
      onTabSelected: (i) => _onTab(context, i),
      child: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Groups list/details shell backed by /groups endpoints.'),
        ),
      ),
    );
  }
}
