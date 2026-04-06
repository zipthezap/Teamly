# Teamly Mobile (Flutter)

Parallel Flutter mobile app scaffold for staged migration from the React web frontend.

## MVP Scope (Phase 1)
- Authentication (login + token bootstrap)
- Dashboard (read-heavy)
- Groups list/details (read-heavy)
- Events list/details + join/leave

## Environments
Environment values are loaded using Dart defines:

- `APP_ENV` (`dev|staging|prod`)
- `API_BASE_URL`

Examples:

```bash
flutter run \
  --dart-define=APP_ENV=dev \
  --dart-define=API_BASE_URL=http://localhost:3000/api
```

## Mobile Push Notifications

This app now includes Firebase push notification integration (`firebase_messaging`).

### Setup requirements
- Add Firebase app configuration files for your platforms:
  - Android: `google-services.json`
  - iOS: `GoogleService-Info.plist`
- Ensure backend is configured with:
  - `FCM_PROJECT_ID`
  - `FCM_SERVICE_ACCOUNT_JSON`

### Behavior implemented
- Requests push permission on startup.
- Registers/refreshes device token with backend endpoint `/api/push-devices`.
- Disables device token on logout.
- Handles foreground/background/tapped notification routing.
- Syncs app icon badge with unread notification count.

## Architecture
- Routing: `go_router`
- State/bootstrap: `flutter_riverpod`
- API client: `dio`
- Secure token persistence: `flutter_secure_storage`
- Error handling: app-level typed exceptions (`core/error`)

## Feature rollout order
1. Auth
2. Dashboard
3. Groups
4. Events
5. Write flows (create/edit/RSVP refinement)
6. Platform capabilities (push/deep links/offline cache)

## CI
Workflow: `.github/workflows/flutter-mobile.yml`
- flutter analyze
- flutter test
- flutter build apk --debug
