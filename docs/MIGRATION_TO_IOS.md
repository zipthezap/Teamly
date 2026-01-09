MIGRATION_TO_IOS.md
Generated: 2026-01-09T15:15:08.366Z

Purpose
-------
This document is a complete, actionable migration plan to create a production-quality iOS app equivalent of the existing Teamly web application while continuing to serve the current React web frontend from the same project. It is intended to be used as an authoritative reference for engineering, product and DevOps teams as they plan and execute the migration.

[...original content above unchanged...]

For follow-up prompts, reference this file path: docs/MIGRATION_TO_IOS.md


---

Concrete Artifacts (added)
--------------------------
This section contains the executable artifacts requested: a minimal OpenAPI example, a precise auth contract, device DB schema + migration example (Prisma), example APNs payloads and deep-link formats, an Axios + Keychain snippet, a CI workflow + Fastlane/EAS blueprint, TestFlight checklist, E2E test matrix and device/iOS matrix, a recommended repo layout, onboarding checklist, and risk/rollback + monitoring SLAs.

1) OpenAPI v3 sample (minimal)
--------------------------------
Save as: docs/openapi.yaml (expand as API surface grows)

openapi: "3.0.3"
info:
  title: Teamly API (mobile)
  version: "1.0.0"
servers:
  - url: https://api.example.com
paths:
  /api/auth/login:
    post:
      summary: Login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                password:
                  type: string
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
  /api/auth/refresh:
    post:
      summary: Refresh tokens
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                refreshToken:
                  type: string
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
components:
  schemas:
    AuthResponse:
      type: object
      properties:
        accessToken:
          type: string
        refreshToken:
          type: string
        user:
          type: object
          properties:
            id:
              type: string
            email:
              type: string

Notes: Generate a full OpenAPI spec from routes (e.g., manually or using a small script that inspects Express routes). Commit openapi.yaml to repo and use openapi-generator to produce a typed API client for mobile.

2) Auth contract (detailed)
---------------------------
- POST /api/auth/login
  - Request: { email, password }
  - Response 200: { accessToken: string (JWT, short-lived ~15m), refreshToken: string (httpOnly secure cookie OR opaque token), user: { id, email, name } }
- POST /api/auth/refresh
  - Request: { refreshToken }
  - Response 200: { accessToken, refreshToken }
  - Behavior: Rotate refresh token on every call; store revocation list and use one-time tokens to prevent replay.
- POST /api/auth/logout
  - Request: { refreshToken }
  - Response 204: clears server-side refresh token and device registrations.

Cookie vs token: For mobile prefer returning accessToken + refreshToken in JSON and storing refreshToken securely in Keychain; do NOT rely on cookies for native apps.

Error handling: 401 for invalid credentials; 401 with reason=token_expired triggers client to call /api/auth/refresh; 403 for revoked tokens.

3) Device DB schema (Prisma) + example migration
------------------------------------------------
Prisma model sample (add to prisma/schema.prisma):

model Device {
  id        String   @id @default(cuid())
  userId    String
  platform  String
  deviceId  String   @unique
  pushToken String?
  appVersion String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
}

Migration SQL (example):
-- 2026xxxx_create_devices_table.sql
CREATE TABLE "Device" (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  platform text NOT NULL,
  "deviceId" text UNIQUE NOT NULL,
  "pushToken" text,
  "appVersion" text,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now()
);

Add server endpoints that CRUD this table (register/delete devices) and use it when sending APNs.

4) APNs payload examples and deep link formats
---------------------------------------------
- Standard push (user-visible):
{
  "aps": {
    "alert": {
      "title": "New invite",
      "body": "You were invited to Weekend Football"
    },
    "sound": "default",
    "category": "EVENT_INVITE",
    "badge": 1
  },
  "data": {
    "type": "event_invite",
    "eventId": "event-uuid-123",
    "deepLink": "teamly://events/event-uuid-123"
  }
}

- Silent push (background sync):
{
  "aps": {
    "content-available": 1
  },
  "data": {
    "type": "sync",
    "since": "2026-01-01T00:00:00Z"
  }
}

Deep link patterns (registered in app):
- teamly://events/:id
- teamly://groups/:id
- teamly://notifications/:id
- https://teamly.example.com/events/:id (universal link)

Note: Implement both universal links (preferred) and custom scheme as fallback.

5) Axios interceptor + Keychain snippet (TypeScript)
---------------------------------------------------
Save as: src/mobile/utils/api.ts

import axios from 'axios';
import * as Keychain from 'react-native-keychain';

const api = axios.create({ baseURL: process.env.API_URL || 'https://api.example.com' });

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function refreshToken() {
  const creds = await Keychain.getGenericPassword();
  if (!creds) return null;
  const refreshToken = JSON.parse(creds.password).refreshToken;
  try {
    const res = await api.post('/api/auth/refresh', { refreshToken });
    const { accessToken, refreshToken: newRefresh } = res.data;
    // store new refresh
    await Keychain.setGenericPassword('tokens', JSON.stringify({ refreshToken: newRefresh }));
    return accessToken;
  } catch (err) {
    return null;
  }
}

api.interceptors.request.use(async (config) => {
  // attach access token from memory or fetch via refresh flow if missing
  // implement per-app in-memory store (not stored to disk)
  const token = (global as any).ACCESS_TOKEN;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(undefined, async (error) => {
  const originalRequest = error.config;
  if (error.response && error.response.status === 401 && !originalRequest._retry) {
    if (isRefreshing) {
      // queue
      return new Promise((resolve) => {
        refreshQueue.push((t: string | null) => {
          if (!t) return resolve(Promise.reject(error));
          originalRequest.headers.Authorization = `Bearer ${t}`;
          resolve(api(originalRequest));
        });
      });
    }
    originalRequest._retry = true;
    isRefreshing = true;
    const newToken = await refreshToken();
    isRefreshing = false;
    refreshQueue.forEach(cb => cb(newToken));
    refreshQueue = [];
    if (newToken) {
      (global as any).ACCESS_TOKEN = newToken;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    }
    // redirect to login flow in app
    throw error;
  }
  throw error;
});

export default api;

Notes: Store the refresh token securely in Keychain (react-native-keychain) and keep access token in-memory only. On app start, call refresh endpoint to populate ACCESS_TOKEN.

6) CI/CD - GitHub Actions minimal workflow (mobile)
--------------------------------------------------
Save as: .github/workflows/mobile.yml

name: Mobile CI
on: [push, pull_request]
jobs:
  lint-test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install deps
        run: npm ci
        working-directory: src/mobile
      - name: Run tests
        run: npm test
        working-directory: src/mobile
  build-eas:
    needs: lint-test
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install EAS CLI
        run: npm install -g eas-cli
      - name: Install deps
        run: npm ci
        working-directory: src/mobile
      - name: EAS Build (iOS)
        env:
          EAS_PROJECT_ID: ${{ secrets.EAS_PROJECT_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
        run: eas build --platform ios --non-interactive
        working-directory: src/mobile

Fastlane: use fastlane to upload to TestFlight inside a separate job or using EAS submit; store APP_STORE_CONNECT API keys in repo secrets.

7) Fastlane / EAS blueprint
---------------------------
- Use EAS Build + EAS Submit for simplicity: EAS handles credentials and building on EAS servers.
- For full automation with Fastlane, add a lane:

lane :beta do
  desc "Push to TestFlight"
  build_app(scheme: "Teamly")
  upload_to_testflight
end

Store Apple keys in GitHub secrets and use match or App Store Connect API keys for signing.

8) TestFlight release checklist
--------------------------------
- App icon, launch images, privacy policy URL
- App Store Connect: fill description, keywords, category, support URL
- Prepare screenshots for required device sizes and locales
- Add appropriate entitlements (Push Notifications, Background Modes)
- Create TestFlight group for internal and external testers
- Verify TestFlight install on a device and validate push notifications and deep links

9) E2E test matrix & device/iOS matrix
--------------------------------------
E2E flows to cover:
- Auth: register/login/logout/refresh
- Group: create, invite, accept invite, remove member
- Event: create/edit/delete, join/leave, recurring event behavior
- Notifications: receive, open deep-link, mark read
- Offline: create event offline, queue and sync
- Media: upload image via presigned URL

Device/OS matrix (minimum):
- iPhone 14 Pro / iOS 17
- iPhone 12 / iOS 16
- iPad Air / iOS 16 (if tablet supported)
- Target: last 3 major iOS versions in support matrix

10) Sample repo layout (recommended)
-------------------------------------
Monorepo option (recommended for code discoverability):
/
  src/
    backend/
    frontend/   (web)
    mobile/     (react native app)
  docs/
  .github/

Pros: shared code (types), single CI, easier onboarding. If privacy/compliance requires separation, create separate mobile repo and reference openapi.yaml.

11) Onboarding checklist for mobile devs
---------------------------------------
- Get Apple Developer access and join the team in App Store Connect
- Install Xcode, Node 20, EAS CLI (if using Expo)
- Create .env.local with API_URL pointing to staging
- Install dependencies: cd src/mobile && npm ci
- Run: npm run ios (or eas build) and validate login
- Get TestFlight access and push credentials from DevOps

12) Risk, rollback and monitoring SLAs
-------------------------------------
Risks:
- Push delivery failure (APNs throttling): Mitigation: implement retry and monitoring, rate limit outbound pushes, fall back to email.
- Token compromise: Mitigation: use short-lived access tokens, support remote revocation and device-level logout.
- Data loss during sync: Mitigation: conservative conflict resolution, store operation log locally until server ack, implement backups.

Rollback plan:
- Feature flag new mobile-only endpoints and gate by release channel.
- If push sync causes issues, switch off silent pushes and require manual refresh.
- If migration causes DB schema issues, prepare rollback migrations and keep backups for 7 days.

Monitoring & SLAs:
- API 99.9% uptime target for mobile-critical endpoints (auth, events).
- Track 5xx rate by client; set alerts when >1%.
- Monitor push failure rates, delivery latency, and enqueue sizes.

13) Next actionable files to add (PR checklist)
-----------------------------------------------
- docs/openapi.yaml (full API surface)
- prisma/migrations/* create_devices_table
- src/backend/routes/deviceRoutes.ts (register/remove device)
- src/mobile/ (scaffolded RN app) with basic auth flow and stored tokens sample
- .github/workflows/mobile.yml

Closing & usage
----------------
This file now contains concrete artifacts to accelerate the mobile migration. Recommended immediate actions:
1. Commit docs/openapi.yaml and run openapi-generator to produce a typed client under src/mobile/api-client.
2. Add the Prisma Device model and run a migration; deploy to staging.
3. Scaffold src/mobile with the Axios + Keychain code above and validate auth + refresh flow.

For future prompts, reference docs/MIGRATION_TO_IOS.md and the added files: docs/openapi.yaml, src/mobile/utils/api.ts, .github/workflows/mobile.yml, and prisma migration files.
