import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/firebase_runtime.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/theme_mode_controller.dart';
import '../features/push_notifications/state/push_notifications_controller.dart';
import 'router.dart';

class TeamlyApp extends ConsumerWidget {
  const TeamlyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final firebaseEnabled = ref.watch(firebaseEnabledProvider);
    if (firebaseEnabled) {
      ref.watch(pushNotificationsControllerProvider);
    }

    final router = buildRouter(ref);
    final themeMode = ref.watch(themeModeProvider);
    return MaterialApp.router(
      title: 'Teamly Mobile',
      theme: buildLightTheme(),
      darkTheme: buildDarkTheme(),
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}
