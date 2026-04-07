import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/app.dart';
import '../core/config/app_config.dart';
import '../core/config/firebase_runtime.dart';

Future<void> bootstrap() async {
  var firebaseEnabled = false;
  try {
    await Firebase.initializeApp();
    firebaseEnabled = true;
  } catch (error, stackTrace) {
    debugPrint('Firebase initialization skipped: $error');
    debugPrintStack(stackTrace: stackTrace);
  }

  final config = AppConfig.fromDefines();

  runApp(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(config),
        firebaseEnabledProvider.overrideWithValue(firebaseEnabled),
      ],
      child: const TeamlyApp(),
    ),
  );
}
