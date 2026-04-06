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
