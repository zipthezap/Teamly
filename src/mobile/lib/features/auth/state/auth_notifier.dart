import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart'
  show kIsWeb, debugPrint;
import 'package:flutter/services.dart' show MissingPluginException;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../../core/config/app_config.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/models/user_model.dart';
import '../../../core/network/session_expired_notifier.dart';
import '../../notifications/state/notifications_notifier.dart';
import '../../push_notifications/state/push_notifications_controller.dart';
import '../data/auth_repository_impl.dart';
import '../domain/auth_repository.dart';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState extends Equatable {
  const AuthState({
    required this.status,
    this.user,
    this.error,
    this.isLoading = false,
  });

  const AuthState.unknown() : this(status: AuthStatus.unknown);
  const AuthState.unauthenticated() : this(status: AuthStatus.unauthenticated);

  final AuthStatus status;
  final UserModel? user;
  final String? error;
  final bool isLoading;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    String? error,
    bool? isLoading,
    bool clearError = false,
    bool clearUser = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: clearUser ? null : (user ?? this.user),
      error: clearError ? null : (error ?? this.error),
      isLoading: isLoading ?? this.isLoading,
    );
  }

  @override
  List<Object?> get props => [status, user, error, isLoading];
}

// ---------------------------------------------------------------------------
// Notifier
// ---------------------------------------------------------------------------

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._repo, this._ref) : super(const AuthState.unknown()) {
    _initAuth();
  }

  final AuthRepository _repo;
  final Ref _ref;

  // Lazily initialized on the first Google sign-in attempt so that the
  // native `init` platform-channel call is never made at app startup.
  // This avoids a MissingPluginException on platforms where the plugin
  // has no native implementation (e.g. desktop runners without a keystore).
  GoogleSignIn? _googleSignIn;

  // Returns the cached GoogleSignIn instance, creating it on first call.
  // On web, clientId is required for google_sign_in_web to initialize the
  // Google Identity Services (GIS) library in the browser.
  // On Android/iOS, serverClientId triggers ID-token generation so the
  // backend can verify the token.
  // We pass null (not an empty string) when no ID is configured.
  GoogleSignIn _getOrCreateGoogleSignIn() {
    if (_googleSignIn != null) return _googleSignIn!;
    final googleClientId = _ref.read(appConfigProvider).googleClientId;
    final clientIdValue = googleClientId.isNotEmpty ? googleClientId : null;
    _googleSignIn = GoogleSignIn(
      scopes: ['email', 'profile'],
      clientId: kIsWeb ? clientIdValue : null,
      serverClientId: kIsWeb ? null : clientIdValue,
    );
    return _googleSignIn!;
  }

  Future<void> _initAuth() async {
    final token = await _repo.getToken();
    if (token == null || token.isEmpty) {
      state = const AuthState.unauthenticated();
      return;
    }

    try {
      final user = await _repo.getProfile();
      state = AuthState(
        status: AuthStatus.authenticated,
        user: user,
        isLoading: false,
      );
    } on DioException catch (e) {
      if (_shouldClearStoredSession(e)) {
        await _repo.logout();
        _invalidateNotificationState();
      }
      state = const AuthState.unauthenticated();
    } catch (_) {
      state = const AuthState.unauthenticated();
    }
  }

  Future<void> login({required String email, required String password}) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final user = await _repo.login(email: email, password: password);
      state = AuthState(
        status: AuthStatus.authenticated,
        user: user,
        isLoading: false,
      );
      _invalidateNotificationState();
      await _registerPushTokenSafely();
    } on Exception catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: _extractMessage(e),
      );
    }
  }

  Future<void> register({
    required String email,
    required String password,
    required String name,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final user =
          await _repo.register(email: email, password: password, name: name);
      state = AuthState(
        status: AuthStatus.authenticated,
        user: user,
        isLoading: false,
      );
      _invalidateNotificationState();
      await _registerPushTokenSafely();
    } on Exception catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: _extractMessage(e),
      );
    }
  }

  Future<void> logout() async {
    await _disablePushTokenSafely();
    // Sign out of any active social provider sessions so the next sign-in
    // shows the account-picker rather than silently reusing cached credentials.
    try {
      await _googleSignIn?.signOut();
    } catch (_) {}
    try {
      if (!kIsWeb) await FacebookAuth.instance.logOut();
    } catch (_) {}
    await _repo.logout();
    state = const AuthState.unauthenticated();
    _invalidateNotificationState();
  }

  // -------------------------------------------------------------------------
  // Social login / register (Google, Facebook, Apple)
  // -------------------------------------------------------------------------

  /// Authenticate with Google via the native SDK, then exchange the Google
  /// ID token for a Teamly server JWT.
  Future<void> loginWithGoogle() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final account = await _getOrCreateGoogleSignIn().signIn();
      if (account == null) {
        // User cancelled
        state = state.copyWith(isLoading: false);
        return;
      }
      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        throw Exception('Google sign-in did not return an ID token');
      }
      final user = await _repo.socialLogin(
        provider: 'google',
        credentials: {'idToken': idToken},
      );
      state = AuthState(
        status: AuthStatus.authenticated,
        user: user,
        isLoading: false,
      );
      _invalidateNotificationState();
      await _registerPushTokenSafely();
    } on MissingPluginException {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: 'Google Sign-In is not supported on this platform.',
      );
    } on Exception catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: _extractMessage(e),
      );
    }
  }

  /// Authenticate with Apple via the native Sign in with Apple SDK, then
  /// exchange the Apple identity token for a Teamly server JWT.
  ///
  /// Only available on iOS and macOS; the button must not be shown on other
  /// platforms.
  Future<void> loginWithApple() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );
      final identityToken = credential.identityToken;
      if (identityToken == null) {
        throw Exception('Apple sign-in did not return an identity token');
      }
      final user = await _repo.socialLogin(
        provider: 'apple',
        credentials: {
          'identityToken': identityToken,
          if (credential.givenName != null) 'givenName': credential.givenName!,
          if (credential.familyName != null)
            'familyName': credential.familyName!,
          if (credential.email != null) 'email': credential.email!,
        },
      );
      state = AuthState(
        status: AuthStatus.authenticated,
        user: user,
        isLoading: false,
      );
      _invalidateNotificationState();
      await _registerPushTokenSafely();
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        // User dismissed the sheet — treat as a no-op.
        state = state.copyWith(isLoading: false);
        return;
      }
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: 'Apple sign-in failed (${e.code.name}).',
      );
    } on MissingPluginException {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: 'Apple Sign-In is not supported on this platform.',
      );
    } on Exception catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: _extractMessage(e),
      );
    }
  }

  /// Authenticate with Facebook via the native SDK, then exchange the
  /// Facebook access token for a Teamly server JWT.
  Future<void> loginWithFacebook() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await FacebookAuth.instance.login(
        permissions: const ['email', 'public_profile'],
      );
      if (result.status == LoginStatus.cancelled) {
        state = state.copyWith(isLoading: false);
        return;
      }
      if (result.status != LoginStatus.success || result.accessToken == null) {
        throw Exception(result.message ?? 'Facebook sign-in failed');
      }
      final user = await _repo.socialLogin(
        provider: 'facebook',
        credentials: {'accessToken': result.accessToken!.tokenString},
      );
      state = AuthState(
        status: AuthStatus.authenticated,
        user: user,
        isLoading: false,
      );
      _invalidateNotificationState();
      await _registerPushTokenSafely();
    } on MissingPluginException {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: 'Facebook Sign-In is not supported on this platform.',
      );
    } on Exception catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: _extractMessage(e),
      );
    }
  }

  // -------------------------------------------------------------------------
  // Account management
  // -------------------------------------------------------------------------

  /// Permanently deletes the current user's account.
  ///
  /// Calls `DELETE /auth/account` to soft-delete the server record and
  /// revoke all active tokens, then clears local session state.
  Future<void> deleteAccount() async {
    state = state.copyWith(isLoading: true, clearError: true);
    var deleteSucceeded = false;
    try {
      await _repo.deleteAccount();
      deleteSucceeded = true;
    } on DioException catch (e) {
      final statusCode = e.response?.statusCode;
      final shouldForceLocalSignOut =
          statusCode == 401 || statusCode == 403 || statusCode == 404;
      if (shouldForceLocalSignOut) {
        await _repo.logout();
        state = const AuthState.unauthenticated();
        _invalidateNotificationState();
        return;
      }
      state = state.copyWith(
        isLoading: false,
        error: _extractMessage(e),
      );
    } on Exception catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _extractMessage(e),
      );
    } finally {
      await _disablePushTokenSafely();
      try {
        await _googleSignIn?.signOut();
      } catch (_) {}
      try {
        if (!kIsWeb) await FacebookAuth.instance.logOut();
      } catch (_) {}
    }
    if (deleteSucceeded) {
      state = const AuthState.unauthenticated();
      _invalidateNotificationState();
    }
  }

  /// Called by the profile page after a successful PUT /auth/profile.
  void updateUser(UserModel user) {
    state = state.copyWith(user: user);
  }

  void clearError() => state = state.copyWith(clearError: true);

  /// Called by the token-refresh interceptor when no refresh is possible.
  void forceLogout() {
    state = const AuthState.unauthenticated();
    _invalidateNotificationState();
  }

  void _invalidateNotificationState() {
    // Invalidate notifications-related providers asynchronously to avoid
    // Riverpod circular dependency errors when called during provider
    // build/listen cycles (see CircularDependencyError stack traces).
    Future.microtask(() {
      try {
        _ref.invalidate(unreadCountProvider);
      } catch (_) {}
      try {
        _ref.invalidate(notificationsNotifierProvider);
      } catch (_) {}
    });
  }

  Future<void> _registerPushTokenSafely() async {
    try {
      await _ref
          .read(pushNotificationsControllerProvider)
          .registerCurrentToken();
      await _ref.read(pushNotificationsControllerProvider).syncBadgeCount();
    } catch (e) {
      debugPrint('Push token registration failed: $e');
    }
  }

  Future<void> _disablePushTokenSafely() async {
    try {
      await _ref
          .read(pushNotificationsControllerProvider)
          .disableCurrentToken();
    } catch (_) {
      // no-op
    }
  }

  String _extractMessage(Exception e) {
    // DioException carries the AppException in its .error field
    if (e is DioException) {
      final inner = e.error;
      if (inner is AppException) return inner.message;
      return e.message ?? 'Network error';
    }
    if (e is AppException) return e.message;
    final msg = e.toString();
    if (msg.startsWith('Exception: ')) return msg.substring(11);
    return msg;
  }

  bool _shouldClearStoredSession(DioException error) {
    final statusCode = error.response?.statusCode;
    if (statusCode == 401 || statusCode == 403 || statusCode == 404) {
      return true;
    }

    final inner = error.error;
    if (inner is AppException) {
      final innerStatus = inner.statusCode;
      if (innerStatus == 401 || innerStatus == 403 || innerStatus == 404) {
        return true;
      }
    }

    return false;
  }
}

final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  final notifier = AuthNotifier(repo, ref);

  // Force logout when the token refresh interceptor signals session expiry.
  ref.listen<int>(sessionExpiredProvider, (_, __) {
    notifier.forceLogout();
  });

  return notifier;
});
