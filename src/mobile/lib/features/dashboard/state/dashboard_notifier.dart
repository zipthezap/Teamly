import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/dashboard_model.dart';
import '../data/dashboard_repository_impl.dart';

/// AsyncNotifier that loads the dashboard aggregate in a single API call.
///
/// The dashboard page watches this provider instead of the separate
/// [groupsNotifierProvider] and [sessionsNotifierProvider], reducing the
/// initial render from 2 network round-trips to 1.
class DashboardNotifier extends AsyncNotifier<DashboardModel> {
  @override
  Future<DashboardModel> build() {
    return ref.watch(dashboardRepositoryProvider).getDashboard();
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
