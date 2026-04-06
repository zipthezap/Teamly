import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/app.dart';
import '../core/config/app_config.dart';

Future<void> bootstrap() async {
  final config = AppConfig.fromDefines();

  runApp(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(config),
      ],
      child: const TeamlyApp(),
    ),
  );
}
