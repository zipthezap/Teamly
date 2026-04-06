# Flutter Mobile Migration Plan (Implementation Baseline)

This document tracks Teamly's staged migration from React web to a parallel Flutter mobile app.

## 1) Migration Scope
- Strategy: **staged rollout** (web and mobile run in parallel)
- MVP mobile features:
  - Auth (login/token session)
  - Dashboard (read-heavy)
  - Groups list/details
  - Events list/details + join/leave

## 2) Backend as Source of Truth
- Mobile reuses existing REST API (`/auth`, `/groups`, `/events`) from backend.
- Current web API contracts referenced from:
  - `src/frontend/src/services/api.ts`
- Mobile-specific assumptions identified:
  - Web uses `localStorage` and browser redirects for auth errors
  - Mobile uses secure storage and route-based navigation
  - OAuth callback/browser flow needs mobile-specific deep-link strategy in later phase

## 3) Parallel Flutter App
- App root: `src/mobile`
- Established architecture baseline:
  - Routing: `go_router`
  - State/bootstrap: `flutter_riverpod`
  - API layer: `dio`
  - Secure token storage: `flutter_secure_storage`
  - Error model: typed app exceptions
- Environments configured with `--dart-define`:
  - `APP_ENV=dev|staging|prod`
  - `API_BASE_URL=...`

## 4) Feature-by-Feature Migration Order
1. Auth flow compatible with JWT backend
2. Dashboard read model
3. Groups read flows
4. Events read flows + join/leave
5. Write-heavy flows (create/edit/RSVP refinement)
6. Advanced capabilities (notifications, deep links, caching)

## 5) Mobile-First UX Direction
- Bottom navigation + stacked route flows
- Touch-first spacing and controls
- Keep Teamly branding but use mobile-native interaction patterns

## 6) Post-Parity Capabilities
- Push notifications
- Deep links/invite links
- Secure token/session hardening
- Optional offline cache for key read screens

## 7) Transition Model
- Keep web app active while mobile reaches parity
- Track feature parity checklist by domain (auth/groups/events)
- Deprecate web-only paths only after usage/stability targets are met

## 8) Operational Readiness
- CI workflow added: `.github/workflows/flutter-mobile.yml`
  - `flutter analyze`
  - `flutter test`
  - `flutter build apk --debug`
- Release, crash monitoring, and analytics setup remain follow-up tasks for production launch.
