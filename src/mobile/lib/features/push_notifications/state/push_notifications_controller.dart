import 'dart:async';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_app_badger/flutter_app_badger.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/firebase_runtime.dart';
import '../../auth/state/auth_notifier.dart';
import '../../notifications/data/notification_repository_impl.dart';
import '../data/push_device_api.dart';

final _lastPushTokenProvider = StateProvider<String?>((ref) => null);
final _pendingPushPathProvider = StateProvider<String?>((ref) => null);

class PushNotificationsController {
  PushNotificationsController(this._ref);
  final Ref _ref;

  StreamSubscription<String>? _tokenRefreshSub;
  StreamSubscription<RemoteMessage>? _foregroundSub;
  StreamSubscription<RemoteMessage>? _openedAppSub;

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    if (!_ref.read(firebaseEnabledProvider)) return;

    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    _foregroundSub = FirebaseMessaging.onMessage.listen((_) async {
      await syncBadgeCount();
    });

    _openedAppSub = FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final path = _routePathFromMessage(message);
      if (path != null) {
        _ref.read(_pendingPushPathProvider.notifier).state = path;
      }
    });

    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      final path = _routePathFromMessage(initialMessage);
      if (path != null) {
        _ref.read(_pendingPushPathProvider.notifier).state = path;
      }
    }

    _tokenRefreshSub =
        FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
      final oldToken = _ref.read(_lastPushTokenProvider);
      await _registerOrRefreshToken(newToken: newToken, oldToken: oldToken);
      _ref.read(_lastPushTokenProvider.notifier).state = newToken;
    });

    if (_ref.read(authNotifierProvider).isAuthenticated) {
      await registerCurrentToken();
      await syncBadgeCount();
    }
  }

  void dispose() {
    _tokenRefreshSub?.cancel();
    _foregroundSub?.cancel();
    _openedAppSub?.cancel();
  }

  Future<void> registerCurrentToken() async {
    if (!_ref.read(firebaseEnabledProvider)) return;
    final token = await FirebaseMessaging.instance.getToken();
    if (token == null || token.isEmpty) return;
    final oldToken = _ref.read(_lastPushTokenProvider);
    await _registerOrRefreshToken(newToken: token, oldToken: oldToken);
    _ref.read(_lastPushTokenProvider.notifier).state = token;
  }

  Future<void> disableCurrentToken() async {
    if (!_ref.read(firebaseEnabledProvider)) {
      _ref.read(_lastPushTokenProvider.notifier).state = null;
      return;
    }
    final token = _ref.read(_lastPushTokenProvider);
    if (token == null || token.isEmpty) return;
    try {
      await _ref.read(pushDeviceApiProvider).disableDevice(token);
    } catch (_) {
      // ignore network failures on logout
    } finally {
      _ref.read(_lastPushTokenProvider.notifier).state = null;
    }
  }

  Future<void> syncBadgeCount() async {
    if (!_ref.read(firebaseEnabledProvider)) return;
    if (!_ref.read(authNotifierProvider).isAuthenticated) return;
    try {
      final unread =
          await _ref.read(notificationRepositoryProvider).getUnreadCount();
      if (unread <= 0) {
        await FlutterAppBadger.removeBadge();
      } else {
        final supported = await FlutterAppBadger.isAppBadgeSupported();
        if (supported) {
          await FlutterAppBadger.updateBadgeCount(unread);
        }
      }
    } catch (_) {
      // ignore badge sync errors
    }
  }

  void consumePendingRouteAndNavigate(BuildContext context) {
    final pending = _ref.read(_pendingPushPathProvider);
    if (pending == null || pending.isEmpty) return;
    _ref.read(_pendingPushPathProvider.notifier).state = null;
    context.go(pending);
  }

  Future<void> _registerOrRefreshToken({
    required String newToken,
    required String? oldToken,
  }) async {
    if (!_ref.read(authNotifierProvider).isAuthenticated) return;
    final api = _ref.read(pushDeviceApiProvider);
    final locale =
        WidgetsBinding.instance.platformDispatcher.locale.toLanguageTag();
    final timezone = DateTime.now().timeZoneName;
    final platform = _platformString();
    if (oldToken != null && oldToken.isNotEmpty && oldToken != newToken) {
      await api.refreshDevice(
        oldToken: oldToken,
        newToken: newToken,
        platform: platform,
        locale: locale,
        timezone: timezone,
      );
      return;
    }
    await api.registerDevice(
      token: newToken,
      platform: platform,
      locale: locale,
      timezone: timezone,
    );
  }

  String _platformString() {
    if (Platform.isIOS) return 'ios';
    if (Platform.isAndroid) return 'android';
    return 'web';
  }

  String? _routePathFromMessage(RemoteMessage message) {
    final data = message.data;
    final actionUrl = data['actionUrl']?.toString();
    if (actionUrl != null && actionUrl.startsWith('/')) {
      return actionUrl;
    }

    final kind = data['notificationKind']?.toString();
    final entityId = data['entityId']?.toString();

    if (entityId == null || entityId.isEmpty) return '/notifications';

    switch (kind) {
      case 'event':
        return '/events/$entityId';
      case 'group':
        return '/groups/$entityId';
      case 'teamup':
        return '/teamup';
      case 'tournament':
        return '/tournaments/$entityId';
      default:
        return '/notifications';
    }
  }
}

final pushNotificationsControllerProvider =
    Provider<PushNotificationsController>((ref) {
  final controller = PushNotificationsController(ref);
  unawaited(controller.initialize());
  ref.onDispose(controller.dispose);
  return controller;
});
