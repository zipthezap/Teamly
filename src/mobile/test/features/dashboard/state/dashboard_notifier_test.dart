import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:teamly_mobile/core/models/dashboard_model.dart';
import 'package:teamly_mobile/core/models/user_model.dart';
import 'package:teamly_mobile/features/auth/data/auth_repository_impl.dart';
import 'package:teamly_mobile/features/auth/domain/auth_repository.dart';
import 'package:teamly_mobile/features/auth/state/auth_notifier.dart';
import 'package:teamly_mobile/features/dashboard/data/dashboard_repository_impl.dart';
import 'package:teamly_mobile/features/dashboard/domain/dashboard_repository.dart';
import 'package:teamly_mobile/features/dashboard/state/dashboard_notifier.dart';

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

class _FakeDashboardRepository implements DashboardRepository {
  _FakeDashboardRepository(this.dashboard);

  final DashboardModel dashboard;
  int getDashboardCalls = 0;

  @override
  Future<DashboardModel> getDashboard() async {
    getDashboardCalls += 1;
    return dashboard;
  }
}

const _emptyStats = DashboardStats(totalSessions: 0, upcomingCount: 0, groupCount: 0);

void main() {
  test('returns an empty shell without calling the repository when unauthenticated', () async {
    final fakeAuthRepo = _FakeAuthRepository();
    final fakeDashboardRepo = _FakeDashboardRepository(const DashboardModel(
      upcomingEvents: [],
      recentGroups: [],
      unreadNotifications: 5,
      stats: _emptyStats,
    ));

    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(fakeAuthRepo),
        dashboardRepositoryProvider.overrideWithValue(fakeDashboardRepo),
      ],
    );
    addTearDown(container.dispose);

    // Trigger AuthNotifier construction and let its async bootstrap settle
    // to AuthStatus.unauthenticated before reading the dashboard.
    container.read(authNotifierProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    expect(container.read(authNotifierProvider).status, AuthStatus.unauthenticated);

    final result = await container.read(dashboardNotifierProvider.future);

    expect(result.unreadNotifications, 0);
    expect(result.upcomingEvents, isEmpty);
    expect(fakeDashboardRepo.getDashboardCalls, 0);
  });

  test('fetches the dashboard once the user is authenticated', () async {
    final user = const UserModel(id: 'u1', email: 'u1@example.com', name: 'Alex');
    final fakeAuthRepo = _FakeAuthRepository(token: 'token-1', profile: user);
    final fakeDashboardRepo = _FakeDashboardRepository(const DashboardModel(
      upcomingEvents: [],
      recentGroups: [],
      unreadNotifications: 3,
      stats: _emptyStats,
    ));

    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(fakeAuthRepo),
        dashboardRepositoryProvider.overrideWithValue(fakeDashboardRepo),
      ],
    );
    addTearDown(container.dispose);

    container.read(authNotifierProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    expect(container.read(authNotifierProvider).status, AuthStatus.authenticated);

    final result = await container.read(dashboardNotifierProvider.future);

    expect(result.unreadNotifications, 3);
    expect(fakeDashboardRepo.getDashboardCalls, 1);
  });

  test('reload re-fetches the dashboard from the repository', () async {
    final user = const UserModel(id: 'u1', email: 'u1@example.com', name: 'Alex');
    final fakeAuthRepo = _FakeAuthRepository(token: 'token-1', profile: user);
    final fakeDashboardRepo = _FakeDashboardRepository(const DashboardModel(
      upcomingEvents: [],
      recentGroups: [],
      unreadNotifications: 1,
      stats: _emptyStats,
    ));

    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(fakeAuthRepo),
        dashboardRepositoryProvider.overrideWithValue(fakeDashboardRepo),
      ],
    );
    addTearDown(container.dispose);

    container.read(authNotifierProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    await container.read(dashboardNotifierProvider.future);
    await container.read(dashboardNotifierProvider.notifier).reload();

    expect(fakeDashboardRepo.getDashboardCalls, 2);
  });
}
