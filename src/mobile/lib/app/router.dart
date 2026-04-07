import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/app_theme.dart';
import '../features/auth/presentation/auth_page.dart';
import '../features/auth/presentation/sessions_page.dart';
import '../features/auth/state/auth_notifier.dart';
import '../features/dashboard/presentation/dashboard_page.dart';
import '../features/discover/presentation/discover_page.dart';
import '../features/events/presentation/event_detail_page.dart';
import '../features/events/presentation/event_form_page.dart';
import '../features/events/presentation/event_statistics_page.dart';
import '../features/events/presentation/events_page.dart';
import '../features/events/data/event_repository_impl.dart';
import '../features/events/presentation/nearby_events_page.dart';
import '../features/groups/data/group_repository_impl.dart';
import '../features/groups/presentation/group_detail_page.dart';
import '../features/groups/presentation/group_form_page.dart';
import '../features/groups/presentation/groups_page.dart';
import '../features/groups/presentation/nearby_groups_page.dart';
import '../features/groups/presentation/public_groups_page.dart';
import '../features/groups/state/groups_notifier.dart';
import '../features/notification_preferences/presentation/notification_preferences_page.dart';
import '../features/notifications/presentation/notifications_page.dart';
import '../features/push_notifications/state/push_notifications_controller.dart';
import '../features/profile/presentation/oauth_connections_page.dart';
import '../features/profile/presentation/profile_page.dart';
import '../features/profile/presentation/profile_pictures_page.dart';
import '../features/reminders/presentation/reminders_page.dart';
import '../features/teamup/presentation/teamup_page.dart';
import '../features/tournaments/presentation/tournaments_page.dart';
import '../features/two_factor/presentation/two_factor_page.dart';
import '../features/event_requests/presentation/event_requests_page.dart';
import '../core/error/app_exception.dart';

final _routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(authNotifierProvider.notifier);

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final authState = ref.read(authNotifierProvider);
      final path = state.uri.path;
      final isAuthRoute = state.matchedLocation == '/auth';
      final isPublicEventInviteRoute =
          path.startsWith('/events/invite/') || path.startsWith('/events/join/');

      if (authState.status == AuthStatus.unknown) return null;
      if (!authState.isAuthenticated &&
          !isAuthRoute &&
          !isPublicEventInviteRoute) {
        return '/auth';
      }
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
              GoRoute(
                path: 'event-requests',
                builder: (context, state) => EventRequestsPage(
                    groupId: state.pathParameters['id']!),
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
      // Web-compatible group invite route alias
      GoRoute(
        path: '/join-group/:groupId',
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
          // Web-compatible event invite route alias
          GoRoute(
            path: 'join/:token',
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
          GoRoute(
            path: 'nearby-groups',
            builder: (context, state) => const NearbyGroupsPage(),
          ),
          GoRoute(
            path: 'event-statistics',
            builder: (context, state) => const EventStatisticsPage(),
          ),
          GoRoute(
            path: 'nearby-events',
            builder: (context, state) => const NearbyEventsPage(),
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
          GoRoute(
            path: 'two-factor',
            builder: (context, state) => const TwoFactorPage(),
          ),
          GoRoute(
            path: 'reminders',
            builder: (context, state) => const RemindersPage(),
          ),
          GoRoute(
            path: 'sessions',
            builder: (context, state) => const SessionsPage(),
          ),
          GoRoute(
            path: 'pictures',
            builder: (context, state) => const ProfilePicturesPage(),
          ),
          GoRoute(
            path: 'connected-accounts',
            builder: (context, state) => const OAuthConnectionsPage(),
          ),
        ],
      ),
    ],
    observers: [
      _PushNavigationObserver(ref),
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
                      Icon(Icons.check_circle_outline,
                          color: AppThemeTokens.success, size: 64),
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
  bool _loading = true;
  bool _done = false;
  String? _error;
  String? _eventId;
  bool _joinedAsGuest = false;
  // True only when the event was resolved and the user is unauthenticated,
  // meaning they should provide a guest name to join.
  bool _needsGuestName = false;
  final _guestNameController = TextEditingController();
  bool _joiningGuest = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _resolveAndJoin());
  }

  @override
  void dispose() {
    _guestNameController.dispose();
    super.dispose();
  }

  Future<void> _resolveAndJoin() async {
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() {
      _loading = true;
      _error = null;
      _needsGuestName = false;
    });
    try {
      final event = await container
          .read(eventRepositoryProvider)
          .getEventByInviteToken(widget.token);
      _eventId = event.id;
      final authState = container.read(authNotifierProvider);
      if (authState.isAuthenticated) {
        await container.read(eventRepositoryProvider).joinEvent(event.id);
        setState(() => _done = true);
      } else {
        setState(() => _needsGuestName = true);
      }
    } catch (e) {
      setState(() => _error = _errorText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _joinAsGuest() async {
    final name = _guestNameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Name is required');
      return;
    }
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() {
      _joiningGuest = true;
      _error = null;
    });
    try {
      await container.read(eventRepositoryProvider).joinEventAsGuest(
            widget.token,
            name,
          );
      setState(() {
        _joinedAsGuest = true;
        _done = true;
      });
    } catch (e) {
      setState(() => _error = _errorText(e));
    } finally {
      if (mounted) setState(() => _joiningGuest = false);
    }
  }

  String _errorText(Object e) {
    if (e is AppException) return e.message;
    return 'An unexpected error occurred. Please try again.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Join Event')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _loading
              ? const Column(mainAxisSize: MainAxisSize.min, children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Joining event…'),
                ])
              : _done
                  ? Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.check_circle_outline,
                          color: AppThemeTokens.success, size: 64),
                      const SizedBox(height: 16),
                      const Text('You joined the event!'),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: () {
                          if (_joinedAsGuest) {
                            context.go('/auth');
                            return;
                          }
                          final eventId = _eventId;
                          if (eventId?.isNotEmpty ?? false) {
                            context.go('/events/$eventId');
                            return;
                          }
                          context.go('/events');
                        },
                        child: Text(_joinedAsGuest ? 'Sign In' : 'View Event'),
                      ),
                    ])
                  : _needsGuestName
                      ? Column(mainAxisSize: MainAxisSize.min, children: [
                          const Text('Enter your name to join this event'),
                          const SizedBox(height: 12),
                          if (_error != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Text(
                                _error!,
                                style: TextStyle(
                                    color:
                                        Theme.of(context).colorScheme.error),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          TextField(
                            controller: _guestNameController,
                            decoration: const InputDecoration(
                              border: OutlineInputBorder(),
                              labelText: 'Your name',
                            ),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: _joiningGuest ? null : _joinAsGuest,
                              child: _joiningGuest
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : const Text('Join as Guest'),
                            ),
                          ),
                        ])
                  : Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.error_outline,
                          color: Theme.of(context).colorScheme.error, size: 64),
                      const SizedBox(height: 16),
                      Text(_error ?? 'Unable to join event',
                          textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _resolveAndJoin,
                        child: const Text('Try Again'),
                      ),
                    ]),
        ),
      ),
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

class _PushNavigationObserver extends NavigatorObserver {
  _PushNavigationObserver(this.ref);
  final Ref ref;

  void _consume(Route<dynamic>? route) {
    final context = route?.navigator?.context;
    if (context == null) return;
    ref.read(pushNotificationsControllerProvider).consumePendingRouteAndNavigate(context);
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _consume(route);
    super.didPush(route, previousRoute);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _consume(previousRoute);
    super.didPop(route, previousRoute);
  }
}
