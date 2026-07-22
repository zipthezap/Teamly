import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:teamly_mobile/core/models/notification_model.dart';
import 'package:teamly_mobile/core/models/user_model.dart';
import 'package:teamly_mobile/features/auth/data/auth_repository_impl.dart';
import 'package:teamly_mobile/features/auth/domain/auth_repository.dart';
import 'package:teamly_mobile/features/auth/state/auth_notifier.dart';
import 'package:teamly_mobile/features/notifications/data/notification_repository_impl.dart';
import 'package:teamly_mobile/features/notifications/domain/notification_repository.dart';
import 'package:teamly_mobile/features/notifications/state/notifications_notifier.dart';

class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({this.token, this.profile});

  final String? token;
  final UserModel? profile;

  @override
  Future<UserModel> login(
          {required String email, required String password}) =>
      throw UnimplementedError();

  @override
  Future<UserModel> register(
          {required String email,
          required String password,
          required String name}) =>
      throw UnimplementedError();

  @override
  Future<UserModel> socialLogin(
          {required String provider,
          required Map<String, String> credentials}) =>
      throw UnimplementedError();

  @override
  Future<UserModel> getProfile() async => profile!;

  @override
  Future<void> logout() async {}

  @override
  Future<void> deleteAccount() => throw UnimplementedError();

  @override
  Future<String?> getToken() async => token;
}

class _FakeNotificationRepository implements NotificationRepository {
  _FakeNotificationRepository({required this.pages});

  final Map<String?, (List<NotificationModel>, String?)> pages;
  int getNotificationsCalls = 0;

  @override
  Future<(List<NotificationModel>, String?)> getNotifications(
      {bool includeRead = false, String? cursor, int limit = 50}) async {
    getNotificationsCalls += 1;
    return pages[cursor] ?? (const <NotificationModel>[], null);
  }

  @override
  Future<int> getUnreadCount() => throw UnimplementedError();

  @override
  Future<void> markAllRead() async {}

  @override
  Future<void> markRead(List<String> ids) async {}
}

NotificationModel _notification(String id, {bool read = false}) {
  return NotificationModel(
    id: id,
    type: 'join',
    notificationType: 'session',
    read: read,
    createdAt: DateTime.utc(2026, 1, 1),
  );
}

void main() {
  test('returns an empty list when no user is authenticated', () async {
    final fakeAuthRepo = _FakeAuthRepository();
    final fakeNotificationRepo = _FakeNotificationRepository(pages: {
      null: ([_notification('n1')], null),
    });

    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(fakeAuthRepo),
        notificationRepositoryProvider.overrideWithValue(fakeNotificationRepo),
      ],
    );
    addTearDown(container.dispose);

    // Trigger AuthNotifier construction, then let its async bootstrap settle.
    container.read(authNotifierProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    final result = await container.read(notificationsNotifierProvider.future);

    expect(result, isEmpty);
    expect(fakeNotificationRepo.getNotificationsCalls, 0);
  });

  test('loads notifications once a user is authenticated', () async {
    final user = const UserModel(id: 'u1', email: 'u1@example.com', name: 'Alex');
    final fakeAuthRepo = _FakeAuthRepository(token: 'token-1', profile: user);
    final notification = _notification('n1');
    final fakeNotificationRepo = _FakeNotificationRepository(pages: {
      null: ([notification], null),
    });

    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(fakeAuthRepo),
        notificationRepositoryProvider.overrideWithValue(fakeNotificationRepo),
      ],
    );
    addTearDown(container.dispose);

    // Wait for AuthNotifier's constructor-triggered _initAuth() to resolve
    // the stored token into an authenticated user.
    container.read(authNotifierProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    expect(container.read(authNotifierProvider).status, AuthStatus.authenticated);

    final result = await container.read(notificationsNotifierProvider.future);

    expect(result, [notification]);
    expect(fakeNotificationRepo.getNotificationsCalls, 1);
  });

  test('markRead updates only the targeted notification', () async {
    final user = const UserModel(id: 'u1', email: 'u1@example.com', name: 'Alex');
    final fakeAuthRepo = _FakeAuthRepository(token: 'token-1', profile: user);
    final first = _notification('n1');
    final second = _notification('n2');
    final fakeNotificationRepo = _FakeNotificationRepository(pages: {
      null: ([first, second], null),
    });

    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(fakeAuthRepo),
        notificationRepositoryProvider.overrideWithValue(fakeNotificationRepo),
      ],
    );
    addTearDown(container.dispose);

    container.read(authNotifierProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    await container.read(notificationsNotifierProvider.future);

    await container.read(notificationsNotifierProvider.notifier).markRead('n1');

    final updated = container.read(notificationsNotifierProvider).requireValue;
    expect(updated.firstWhere((n) => n.id == 'n1').read, isTrue);
    expect(updated.firstWhere((n) => n.id == 'n2').read, isFalse);
  });

  test('markAllRead marks every notification as read', () async {
    final user = const UserModel(id: 'u1', email: 'u1@example.com', name: 'Alex');
    final fakeAuthRepo = _FakeAuthRepository(token: 'token-1', profile: user);
    final first = _notification('n1');
    final second = _notification('n2');
    final fakeNotificationRepo = _FakeNotificationRepository(pages: {
      null: ([first, second], null),
    });

    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(fakeAuthRepo),
        notificationRepositoryProvider.overrideWithValue(fakeNotificationRepo),
      ],
    );
    addTearDown(container.dispose);

    container.read(authNotifierProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    await container.read(notificationsNotifierProvider.future);

    await container.read(notificationsNotifierProvider.notifier).markAllRead();

    final updated = container.read(notificationsNotifierProvider).requireValue;
    expect(updated.every((n) => n.read), isTrue);
  });
}
