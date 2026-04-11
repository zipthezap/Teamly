import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/app.dart';
import '../core/config/app_config.dart';
import '../core/config/firebase_runtime.dart';

bool _shouldInitializeFirebase() {
  if (kIsWeb) return true;

  // dart:io Platform is not available on web; guard with kIsWeb above.
  // ignore: do_not_use_environment
  return defaultTargetPlatform == TargetPlatform.android ||
      defaultTargetPlatform == TargetPlatform.iOS;
}

Future<void> bootstrap() async {
  var firebaseEnabled = false;
  if (_shouldInitializeFirebase()) {
    try {
      await Firebase.initializeApp();
      firebaseEnabled = true;
    } catch (error) {
      debugPrint('Firebase initialization skipped: $error');
    }
  } else {
    debugPrint('Firebase initialization skipped on this platform.');
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
