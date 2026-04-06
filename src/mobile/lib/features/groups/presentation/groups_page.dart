import 'package:flutter/material.dart';

import '../../../shared/widgets/mobile_shell.dart';

class GroupsPage extends StatelessWidget {
  const GroupsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const MobileShell(
      title: 'Groups',
      currentIndex: 1,
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Groups list/details shell backed by /groups endpoints.'),
        ),
      ),
    );
  }
}
