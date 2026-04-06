import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/presentation/auth_page.dart';
import '../features/auth/state/auth_notifier.dart';
import '../features/dashboard/presentation/dashboard_page.dart';
import '../features/discover/presentation/discover_page.dart';
import '../features/events/presentation/event_detail_page.dart';
import '../features/events/presentation/event_form_page.dart';
import '../features/events/presentation/events_page.dart';
import '../features/groups/data/group_repository_impl.dart';
import '../features/groups/presentation/group_detail_page.dart';
import '../features/groups/presentation/group_form_page.dart';
import '../features/groups/presentation/groups_page.dart';
import '../features/groups/presentation/public_groups_page.dart';
import '../features/groups/state/groups_notifier.dart';
import '../features/notification_preferences/presentation/notification_preferences_page.dart';
import '../features/notifications/presentation/notifications_page.dart';
import '../features/profile/presentation/profile_page.dart';
import '../features/teamup/presentation/teamup_page.dart';
import '../features/tournaments/presentation/tournaments_page.dart';

final _routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(authNotifierProvider.notifier);

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final authState = ref.read(authNotifierProvider);
      final isAuthRoute = state.matchedLocation == '/auth';

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

      // Groups
      GoRoute(
        path: '/groups',
        builder: (context, state) => const GroupsPage(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const GroupFormPage(),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) =>
                GroupDetailPage(groupId: state.pathParameters['id']!),
            routes: [
              GoRoute(
                path: 'events/new',
                builder: (context, state) => EventFormPage(
                  groupId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
        ],
      ),

      // Group invite deep link: /groups/invite/:groupId
      GoRoute(
        path: '/groups/invite/:groupId',
        builder: (context, state) =>
            _GroupInviteLandingPage(groupId: state.pathParameters['groupId']!),
      ),

      // Events
      GoRoute(
        path: '/events',
        builder: (context, state) => const EventsPage(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => EventFormPage(
              groupId: state.uri.queryParameters['groupId'] ?? '',
            ),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) =>
                EventDetailPage(eventId: state.pathParameters['id']!),
          ),
          // Event invite deep link
          GoRoute(
            path: 'invite/:token',
            builder: (context, state) => _EventInviteLandingPage(
                token: state.pathParameters['token']!),
          ),
        ],
      ),

      // Discover hub
      GoRoute(
        path: '/discover',
        builder: (context, state) => const DiscoverPage(),
        routes: [
          GoRoute(
            path: 'public-groups',
            builder: (context, state) => const PublicGroupsPage(),
          ),
        ],
      ),

      // TeamUp
      GoRoute(
        path: '/teamup',
        builder: (context, state) => const TeamUpPage(),
      ),

      // Tournaments
      GoRoute(
        path: '/tournaments',
        builder: (context, state) => const TournamentsPage(),
        routes: [
          GoRoute(
            path: 'create',
            builder: (context, state) => const CreateTournamentPage(),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) => TournamentDetailPage(
                tournamentId: state.pathParameters['id']!),
          ),
        ],
      ),

      // Notifications
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsPage(),
      ),

      // Profile
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfilePage(),
        routes: [
          GoRoute(
            path: 'notification-preferences',
            builder: (context, state) => const NotificationPreferencesPage(),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: const Text('Not Found')),
      body: Center(child: Text('Route not found: ${state.uri.path}')),
    ),
  );
});

// ---------------------------------------------------------------------------
// Group invite landing page
// ---------------------------------------------------------------------------

class _GroupInviteLandingPage extends ConsumerStatefulWidget {
  const _GroupInviteLandingPage({required this.groupId});
  final String groupId;

  @override
  ConsumerState<_GroupInviteLandingPage> createState() =>
      _GroupInviteLandingPageState();
}

class _GroupInviteLandingPageState
    extends ConsumerState<_GroupInviteLandingPage> {
  bool _joining = false;
  bool _done = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _join();
  }

  Future<void> _join() async {
    setState(() {
      _joining = true;
      _error = null;
    });
    try {
      await ref.read(groupRepositoryProvider).joinGroupByInvite(widget.groupId);
      ref.read(groupsNotifierProvider.notifier).load();
      setState(() => _done = true);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Join Group')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: _joining
              ? const Column(mainAxisSize: MainAxisSize.min, children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Joining group…'),
                ])
              : _done
                  ? Column(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.check_circle_outline,
                          color: Colors.green, size: 64),
                      const SizedBox(height: 16),
                      const Text('You joined the group!'),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: () =>
                            context.go('/groups/${widget.groupId}'),
                        child: const Text('View Group'),
                      ),
                    ])
                  : Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.error_outline,
                          color: Theme.of(context).colorScheme.error,
                          size: 64),
                      const SizedBox(height: 16),
                      Text(_error ?? 'An error occurred'),
                      const SizedBox(height: 16),
                      FilledButton(
                          onPressed: _join, child: const Text('Try Again')),
                    ]),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Event invite landing page
// ---------------------------------------------------------------------------

class _EventInviteLandingPage extends StatefulWidget {
  const _EventInviteLandingPage({required this.token});
  final String token;

  @override
  State<_EventInviteLandingPage> createState() =>
      _EventInviteLandingPageState();
}

class _EventInviteLandingPageState extends State<_EventInviteLandingPage> {
  @override
  void initState() {
    super.initState();
    // Redirect to events list; token-based join is handled server-side via
    // the guest join flow. In a full implementation this would POST
    // /events/invite/:token/join as a guest or navigate to the event.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.go('/events');
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}

// ---------------------------------------------------------------------------
// RouterNotifier
// ---------------------------------------------------------------------------

class RouterNotifier extends ChangeNotifier {
  RouterNotifier(Ref ref, AuthNotifier authNotifier) {
    ref.listen<AuthState>(authNotifierProvider, (_, __) {
      notifyListeners();
    });
  }
}

GoRouter buildRouter(WidgetRef ref) => ref.watch(_routerProvider);
