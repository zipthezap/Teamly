import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/app_theme.dart';
import '../features/push_notifications/state/push_notifications_controller.dart';
import 'router.dart';

class TeamlyApp extends ConsumerWidget {
  const TeamlyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(pushNotificationsControllerProvider);
    final router = buildRouter(ref);
    return MaterialApp.router(
      title: 'Teamly Mobile',
      theme: buildAppTheme(),
      routerConfig: router,
    );
  }
}
