import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../../core/config/app_config.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/models/user_model.dart';
import '../../../core/network/session_expired_notifier.dart';
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
    // Build the GoogleSignIn instance with the web client ID so that
    // authentication.idToken is populated on Android (and optionally iOS).
    // The serverClientId must match GOOGLE_CLIENT_ID on the backend.
    // We pass null (not an empty string) when no ID is configured so that
    // GoogleSignIn skips idToken generation rather than rejecting the empty value.
    final googleClientId = _ref.read(appConfigProvider).googleClientId;
    _googleSignIn = GoogleSignIn(
      scopes: ['email', 'profile'],
      serverClientId: googleClientId.isNotEmpty ? googleClientId : null,
    );
    _initAuth();
  }

  final AuthRepository _repo;
  final Ref _ref;

  // Reuse a single GoogleSignIn instance to preserve cached credentials.
  late final GoogleSignIn _googleSignIn;

  Future<void> _initAuth() async {
    try {
      final token = await _repo.getToken();
      if (token != null && token.isNotEmpty) {
        final user = await _repo.getProfile();
        state = AuthState(status: AuthStatus.authenticated, user: user);
      } else {
        state = const AuthState.unauthenticated();
      }
    } catch (_) {
      state = const AuthState.unauthenticated();
    }
  }

  Future<void> login({required String email, required String password}) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final user = await _repo.login(email: email, password: password);
      state = AuthState(status: AuthStatus.authenticated, user: user);
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
      final user = await _repo.register(email: email, password: password, name: name);
      state = AuthState(status: AuthStatus.authenticated, user: user);
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
      await _googleSignIn.signOut();
    } catch (_) {}
    try {
      await FacebookAuth.instance.logOut();
    } catch (_) {}
    await _repo.logout();
    state = const AuthState.unauthenticated();
  }

  // -------------------------------------------------------------------------
  // Social login / register (Google, Facebook, Apple)
  // -------------------------------------------------------------------------

  /// Authenticate with Google via the native SDK, then exchange the Google
  /// ID token for a Teamly server JWT.
  Future<void> loginWithGoogle() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final account = await _googleSignIn.signIn();
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
      state = AuthState(status: AuthStatus.authenticated, user: user);
      await _registerPushTokenSafely();
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
      final result = await FacebookAuth.instance.login(permissions: ['email', 'public_profile']);
      if (result.status == LoginStatus.cancelled) {
        state = state.copyWith(isLoading: false);
        return;
      }
      if (result.status != LoginStatus.success || result.accessToken == null) {
        throw Exception('Facebook sign-in failed: ${result.message}');
      }
      final user = await _repo.socialLogin(
        provider: 'facebook',
        credentials: {'accessToken': result.accessToken!.tokenString},
      );
      state = AuthState(status: AuthStatus.authenticated, user: user);
      await _registerPushTokenSafely();
    } on Exception catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: _extractMessage(e),
      );
    }
  }

  /// Authenticate with Apple ID (iOS/macOS only), then exchange the Apple
  /// identity token for a Teamly server JWT.
  Future<void> loginWithApple() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );
      final Map<String, String> body = {
        'identityToken': credential.identityToken ?? '',
      };
      if (credential.givenName != null) body['givenName'] = credential.givenName!;
      if (credential.familyName != null) body['familyName'] = credential.familyName!;
      if (credential.email != null) body['email'] = credential.email!;

      final user = await _repo.socialLogin(provider: 'apple', credentials: body);
      state = AuthState(status: AuthStatus.authenticated, user: user);
      await _registerPushTokenSafely();
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        state = state.copyWith(isLoading: false);
        return;
      }
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: e.message,
      );
    } on Exception catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: _extractMessage(e),
      );
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
  }

  Future<void> _registerPushTokenSafely() async {
    try {
      await _ref.read(pushNotificationsControllerProvider).registerCurrentToken();
      await _ref.read(pushNotificationsControllerProvider).syncBadgeCount();
    } catch (_) {
      // no-op
    }
  }

  Future<void> _disablePushTokenSafely() async {
    try {
      await _ref.read(pushNotificationsControllerProvider).disableCurrentToken();
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
}

final authNotifierProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  final notifier = AuthNotifier(repo, ref);

  // Force logout when the token refresh interceptor signals session expiry.
  ref.listen<int>(sessionExpiredProvider, (_, __) {
    notifier.forceLogout();
  });

  return notifier;
});
