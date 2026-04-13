import { Router } from 'express';
import * as tournamentController from '../controllers/tournamentController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireTournamentPermission, requireTeamPermission } from '../middleware/authorization';
import { Permission } from '../../shared/types/permissions.types';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// All tournament routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Tournament CRUD
router.post('/', noCache, asyncHandler(tournamentController.createTournament));
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data; server-side cache (Redis/in-memory) remains active
router.get('/', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getTournaments));
router.get('/:id', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getTournament));
router.put(
  '/:id',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.updateTournament)
);
router.delete(
  '/:id',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_DELETE),
  asyncHandler(tournamentController.deleteTournament)
);

// Team management
router.post(
  '/:id/teams/self-register',
  noCache,
  asyncHandler(tournamentController.selfRegisterTeam)
);
router.post(
  '/:id/teams',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(tournamentController.addTeam)
);
router.put(
  '/:id/teams/:teamId',
  noCache,
  requireTeamPermission(Permission.TEAM_UPDATE),
  asyncHandler(tournamentController.updateTeam)
);
router.delete(
  '/:id/teams/:teamId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(tournamentController.deleteTeam)
);
router.put(
  '/:id/teams/:teamId/pool',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.assignTeamToPool)
);

// Player management
router.post(
  '/:id/teams/:teamId/players',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.addPlayer)
);
router.get('/:id/teams/:teamId/players', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getPlayers));
router.put(
  '/:id/teams/:teamId/players/:playerId',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.updatePlayer)
);
router.delete(
  '/:id/teams/:teamId/players/:playerId',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.removePlayer)
);

// Team invitations
router.post(
  '/:id/teams/:teamId/invitations',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.sendTeamInvitation)
);
router.get(
  '/:id/teams/:teamId/invitations',
  etagMiddleware({ weak: true }),
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.getTeamInvitations)
);
router.delete(
  '/:id/teams/:teamId/invitations/:invitationId',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.cancelTeamInvitation)
);

// User invitations (no team permission needed, just authentication)
router.get('/invitations/my', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getUserInvitations));
router.post('/invitations/:inviteToken/accept', noCache, asyncHandler(tournamentController.acceptTeamInvitation));
router.post('/invitations/:inviteToken/decline', noCache, asyncHandler(tournamentController.declineTeamInvitation));

// Bracket and match management
router.post(
  '/:id/generate-brackets',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_BRACKETS),
  asyncHandler(tournamentController.generateBrackets)
);
router.post(
  '/:id/matches/:matchId/score',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_SUBMIT_SCORES),
  asyncHandler(tournamentController.submitScore)
);

// Manual bracket management (admin only)
router.post(
  '/:id/matches',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.createMatch)
);
router.put(
  '/:id/matches/:matchId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.updateMatch)
);
router.delete(
  '/:id/matches/:matchId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.deleteMatch)
);
router.put(
  '/:id/matches/:matchId/referee',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_ASSIGN_REFEREES),
  asyncHandler(tournamentController.assignReferee)
);

// Standings
router.get('/:id/standings', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getStandings));

// Pool management
router.get('/:id/pools', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getPools));
router.get('/:id/pools/:poolId', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getPoolDetails));
router.post(
  '/:id/pools',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.createPool)
);
router.put(
  '/:id/pools/:poolId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.updatePool)
);
router.delete(
  '/:id/pools/:poolId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.deletePool)
);
router.post(
  '/:id/pools/:poolId/teams/:teamId',
  noCache,
  requireTeamPermission(Permission.TEAM_REGISTER_TO_POOL),
  asyncHandler(tournamentController.registerTeamToPool)
);
router.delete(
  '/:id/pools/:poolId/teams/:teamId',
  noCache,
  requireTeamPermission(Permission.TEAM_REGISTER_TO_POOL),
  asyncHandler(tournamentController.removeTeamFromPool)
);
router.delete(
  '/:id/pools/:poolId/waitlist/:teamId',
  noCache,
  requireTeamPermission(Permission.TEAM_REGISTER_TO_POOL),
  asyncHandler(tournamentController.removeTeamFromWaitlist)
);

// Category management
router.get('/:id/categories', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getCategories));
router.post(
  '/:id/categories',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.createCategory)
);
router.put(
  '/:id/categories/:categoryId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.updateCategory)
);
router.delete(
  '/:id/categories/:categoryId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.deleteCategory)
);
router.put(
  '/:id/pools/:poolId/category',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.assignPoolToCategory)
);

// Admin delegation
router.get(
  '/:id/admins',
  etagMiddleware({ weak: true }),
  requireTournamentPermission(Permission.TOURNAMENT_VIEW_ADMIN_PANEL),
  asyncHandler(tournamentController.getAdmins)
);
router.post(
  '/:id/admins',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.addAdmin)
);
router.delete(
  '/:id/admins/:adminUserId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.removeAdmin)
);

export default router;
