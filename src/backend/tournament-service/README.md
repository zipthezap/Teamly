# Tournament Service (Bootstrap)

This folder contains the first standalone Tournament Service runtime scaffold.

## Current endpoints

- GET /health
- GET /api/tournaments/public
- GET /api/tournaments/invitations/preview/:inviteToken
- GET /api/tournaments/invitations/my
- POST /api/tournaments/invitations/:inviteToken/accept
- POST /api/tournaments/invitations/:inviteToken/decline
- GET /api/tournaments/invitations/:inviteToken
- POST /api/tournaments/:id/teams/:teamId/invitations
- GET /api/tournaments/:id/teams/:teamId/invitations
- DELETE /api/tournaments/:id/teams/:teamId/invitations/:invitationId
- POST /api/tournaments/:id/matches/:matchId/cancel
- GET /api/tournaments/:id/summary
- GET /api/tournaments/:id/matches
- GET /api/tournaments/:id/standings
- GET /api/tournaments/:id/match-count

## Run in development

From repository root:

- npm run tournament-service:dev

## Run compiled build

From repository root:

- npm run build
- npm run tournament-service:start

## Notes

- This bootstrap currently reuses the existing Prisma configuration.
- Next step is endpoint-by-endpoint extraction from the monolith controllers.
