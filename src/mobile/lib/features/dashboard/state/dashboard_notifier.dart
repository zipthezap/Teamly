import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/dashboard_model.dart';
import '../../auth/state/auth_notifier.dart';
import '../data/dashboard_repository_impl.dart';

/// AsyncNotifier that loads the dashboard aggregate in a single API call.
///
/// The dashboard page watches this provider instead of the separate
/// [groupsNotifierProvider] and [sessionsNotifierProvider], reducing the
/// initial render from 2 network round-trips to 1.
///
/// Watching [authNotifierProvider] causes the build to re-run when the user
/// authenticates, so a fresh fetch is performed immediately after login
/// instead of displaying the stale unauthenticated error state.
class DashboardNotifier extends AsyncNotifier<DashboardModel> {
  @override
  Future<DashboardModel> build() {
    final authState = ref.watch(authNotifierProvider);

    // While authentication status is still being determined (app start-up),
    // return a never-completing future so the UI shows a loading spinner
    // rather than a flash of empty content or a spurious 401 error.
    if (authState.status == AuthStatus.unknown) {
      return Completer<DashboardModel>().future;
    }

    // Router redirects unauthenticated users to /auth, but if the provider
    // is evaluated before the redirect fires, return an empty shell so no
    // 401 API call is made.
    if (!authState.isAuthenticated) {
      return Future.value(const DashboardModel(
        upcomingEvents: [],
        recentGroups: [],
        unreadNotifications: 0,
        stats: DashboardStats(
          totalSessions: 0,
          upcomingCount: 0,
          groupCount: 0,
        ),
      ));
    }

    return ref.read(dashboardRepositoryProvider).getDashboard();
  }

  /// Reload dashboard data (e.g. on pull-to-refresh).
  Future<void> reload() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(dashboardRepositoryProvider).getDashboard(),
    );
  }
}

final dashboardNotifierProvider =
    AsyncNotifierProvider<DashboardNotifier, DashboardModel>(
        DashboardNotifier.new);
