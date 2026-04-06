import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/app.dart';
import '../core/config/app_config.dart';

Future<void> bootstrap() async {
  await Firebase.initializeApp();
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
