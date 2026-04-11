import 'package:flutter_app_badger/flutter_app_badger.dart';

Future<void> updateBadge(int count) async {
  if (count <= 0) {
    await FlutterAppBadger.removeBadge();
  } else {
    final supported = await FlutterAppBadger.isAppBadgeSupported();
    if (supported) {
      await FlutterAppBadger.updateBadgeCount(count);
    }
  }
}
