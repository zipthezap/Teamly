import 'package:flutter/material.dart';

import '../../../shared/widgets/mobile_shell.dart';

class EventsPage extends StatelessWidget {
  const EventsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const MobileShell(
      title: 'Events',
      currentIndex: 2,
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Events list/details + join/leave shell backed by /events endpoints.'),
        ),
      ),
    );
  }
}
