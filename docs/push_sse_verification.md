Push / SSE verification checklist

1) Purpose
- Verify that tournament notifications (invite, team_registered, team_declined) are delivered via server-side NotificationFactory to mobile clients via SSE or push.

2) Preconditions
- Backend running against a dev/staging database with seeded users and a mobile app registered with a push token (or SSE client enabled).
- `DATABASE_URL` set and migrations applied.

3) SSE verification (desktop or device)
- Start backend in dev mode.
- In a browser or SSE client, open `/sse/stream` (or the SSE endpoint used by the app) and confirm connection opens.
- As organizer/captain, create an invitation (POST `/api/tournaments/:id/teams/:teamId/invitations`).
- Expect to receive an SSE event with type `tournament_notification` or relevant channel that includes `notification` payload in JSON.
- Confirm the received payload contains `notificationType: 'tournament'` and `params.inviteToken`.

4) Push (APNs/FCM) verification
- Ensure mobile client has a valid push token registered via `/api/push-tokens`.
- Create an invitation for a registered user.
- Confirm server logs show push dispatch to push service and response OK.
- Verify device receives push containing `data` payload with `inviteToken` and `actionUrl`.

5) Mobile app behavior
- Open Notifications screen. New notification should appear. Tap it to deep-link to `/tournaments/invite/:token`.
- On invite landing, accept the invitation. Confirm server marks invitation accepted and captain receives `team_registered` notification via SSE/push.

6) Troubleshooting
- If no SSE events: check SSE connection auth, CORS, and server logs.
- If no push: verify push credentials, token registration, and NotificationFactory logs.

Notes
- NotificationFactory already constructs `actionUrl` and `params.inviteToken` when creating tournament invite notifications.
- For full E2E, run tests on a real device or emulator with network access to the backend.
