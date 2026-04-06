import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/presentation/auth_page.dart';
import '../features/dashboard/presentation/dashboard_page.dart';
import '../features/events/presentation/events_page.dart';
import '../features/groups/presentation/groups_page.dart';

final appRouter = GoRouter(
  initialLocation: '/auth',
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
    ),
    GoRoute(
      path: '/events',
      builder: (context, state) => const EventsPage(),
    ),
  ],
  errorBuilder: (context, state) => Scaffold(
    appBar: AppBar(title: const Text('Not Found')),
    body: Center(child: Text('Route not found: ${state.uri.path}')),
  ),
);
