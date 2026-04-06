import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/presentation/auth_page.dart';
import '../features/auth/state/auth_notifier.dart';
import '../features/dashboard/presentation/dashboard_page.dart';
import '../features/events/presentation/event_detail_page.dart';
import '../features/events/presentation/events_page.dart';
import '../features/groups/presentation/group_detail_page.dart';
import '../features/groups/presentation/groups_page.dart';
import '../features/notifications/presentation/notifications_page.dart';
import '../features/profile/presentation/profile_page.dart';

// The router needs access to auth state for the redirect guard.
// We expose a provider so the ProviderScope can supply it.
final _routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(authNotifierProvider.notifier);

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final authState = ref.read(authNotifierProvider);

      final isAuthRoute = state.matchedLocation == '/auth';

      // Still initialising — no redirect yet
      if (authState.status == AuthStatus.unknown) return null;

      if (!authState.isAuthenticated && !isAuthRoute) return '/auth';
      if (authState.isAuthenticated && isAuthRoute) return '/dashboard';
      return null;
    },
    refreshListenable: RouterNotifier(ref, authNotifier),
    routes: [
      GoRoute(
        path: '/auth',
        builder: (context, state) => const AuthPage(),
      ),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const DashboardPage(),
      ),
      GoRoute(
        path: '/groups',
        builder: (context, state) => const GroupsPage(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (context, state) =>
                GroupDetailPage(groupId: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(
        path: '/events',
        builder: (context, state) => const EventsPage(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (context, state) =>
                EventDetailPage(eventId: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsPage(),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfilePage(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: const Text('Not Found')),
      body: Center(child: Text('Route not found: ${state.uri.path}')),
    ),
  );
});

/// Bridges Riverpod auth state changes into a [Listenable] that GoRouter
/// uses to trigger redirect re-evaluation.
class RouterNotifier extends ChangeNotifier {
  RouterNotifier(Ref ref, AuthNotifier authNotifier) {
    ref.listen<AuthState>(authNotifierProvider, (_, __) {
      notifyListeners();
    });
  }
}

// Keep the simple top-level accessor for use in app.dart
GoRouter buildRouter(WidgetRef ref) => ref.watch(_routerProvider);

