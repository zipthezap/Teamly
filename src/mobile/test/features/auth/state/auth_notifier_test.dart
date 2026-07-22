import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:teamly_mobile/core/models/user_model.dart';
import 'package:teamly_mobile/features/auth/data/auth_repository_impl.dart';
import 'package:teamly_mobile/features/auth/domain/auth_repository.dart';
import 'package:teamly_mobile/features/auth/state/auth_notifier.dart';

class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({this.token, this.profile});

  String? token;
  UserModel? profile;
  Exception? loginError;
  Exception? registerError;
  bool loggedOut = false;

  int loginCalls = 0;
  int registerCalls = 0;
  int logoutCalls = 0;

  @override
  Future<UserModel> login(
      {required String email, required String password}) async {
    loginCalls += 1;
    if (loginError != null) throw loginError!;
    return profile!;
  }

  @override
  Future<UserModel> register({
    required String email,
    required String password,
    required String name,
  }) async {
    registerCalls += 1;
    if (registerError != null) throw registerError!;
    return profile!;
  }

  @override
  Future<UserModel> socialLogin(
          {required String provider,
          required Map<String, String> credentials}) =>
      throw UnimplementedError();

  @override
  Future<UserModel> getProfile() async {
    if (profile == null) throw Exception('No profile');
    return profile!;
  }

  @override
  Future<void> logout() async {
    logoutCalls += 1;
    loggedOut = true;
    token = null;
  }

  @override
  Future<void> deleteAccount() => throw UnimplementedError();

  @override
  Future<String?> getToken() async => token;
}

UserModel _user(String id, String name) {
  return UserModel(id: id, email: '$id@example.com', name: name);
}

void main() {
  test('starts unauthenticated when no stored token exists', () async {
    final fakeRepo = _FakeAuthRepository();
    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    // Reading the provider constructs the AuthNotifier, which kicks off its
    // constructor-triggered _initAuth() in the background; give it a couple
    // of event-loop turns to resolve before asserting on the result.
    container.read(authNotifierProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(
      container.read(authNotifierProvider).status,
      AuthStatus.unauthenticated,
    );
  });

  test('login succeeds and stores the returned user', () async {
    final user = _user('u1', 'Alex');
    final fakeRepo = _FakeAuthRepository(profile: user);
    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container
        .read(authNotifierProvider.notifier)
        .login(email: 'alex@example.com', password: 'secret');

    final state = container.read(authNotifierProvider);
    expect(state.status, AuthStatus.authenticated);
    expect(state.user, user);
    expect(state.isLoading, isFalse);
    expect(fakeRepo.loginCalls, 1);
  });

  test('login failure surfaces the error message and stays unauthenticated', () async {
    final fakeRepo = _FakeAuthRepository()
      ..loginError = Exception('Invalid credentials');
    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container
        .read(authNotifierProvider.notifier)
        .login(email: 'alex@example.com', password: 'wrong');

    final state = container.read(authNotifierProvider);
    expect(state.status, AuthStatus.unauthenticated);
    expect(state.error, 'Invalid credentials');
    expect(state.isLoading, isFalse);
  });

  test('logout clears the authenticated user', () async {
    final user = _user('u1', 'Alex');
    final fakeRepo = _FakeAuthRepository(profile: user);
    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container
        .read(authNotifierProvider.notifier)
        .login(email: 'alex@example.com', password: 'secret');
    await container.read(authNotifierProvider.notifier).logout();

    expect(
      container.read(authNotifierProvider).status,
      AuthStatus.unauthenticated,
    );
    expect(container.read(authNotifierProvider).user, isNull);
    expect(fakeRepo.logoutCalls, 1);
  });

  test('updateUser replaces the current user without changing status', () async {
    final user = _user('u1', 'Alex');
    final updated = _user('u1', 'Alexandra');
    final fakeRepo = _FakeAuthRepository(profile: user);
    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container
        .read(authNotifierProvider.notifier)
        .login(email: 'alex@example.com', password: 'secret');
    container.read(authNotifierProvider.notifier).updateUser(updated);

    final state = container.read(authNotifierProvider);
    expect(state.status, AuthStatus.authenticated);
    expect(state.user, updated);
  });

  test('forceLogout resets state to unauthenticated', () async {
    final user = _user('u1', 'Alex');
    final fakeRepo = _FakeAuthRepository(profile: user);
    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container
        .read(authNotifierProvider.notifier)
        .login(email: 'alex@example.com', password: 'secret');
    container.read(authNotifierProvider.notifier).forceLogout();

    expect(
      container.read(authNotifierProvider).status,
      AuthStatus.unauthenticated,
    );
  });

  test('clearError removes a previously set error without changing user', () async {
    final fakeRepo = _FakeAuthRepository()..loginError = Exception('boom');
    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(fakeRepo)],
    );
    addTearDown(container.dispose);

    await container
        .read(authNotifierProvider.notifier)
        .login(email: 'alex@example.com', password: 'wrong');
    expect(container.read(authNotifierProvider).error, 'boom');

    container.read(authNotifierProvider.notifier).clearError();

    expect(container.read(authNotifierProvider).error, isNull);
  });
}
