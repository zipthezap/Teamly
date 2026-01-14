import { Router } from 'express';
import * as tournamentController from '../controllers/tournamentController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireTournamentPermission, requireTeamPermission } from '../middleware/authorization';
import { Permission } from '../../shared/types/permissions.types';

const router = Router();

// All tournament routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Tournament CRUD
router.post('/', asyncHandler(tournamentController.createTournament));
router.get('/', asyncHandler(tournamentController.getTournaments));
router.get('/:id', asyncHandler(tournamentController.getTournament));
router.put(
  '/:id',
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.updateTournament)
);
router.delete(
  '/:id',
  requireTournamentPermission(Permission.TOURNAMENT_DELETE),
  asyncHandler(tournamentController.deleteTournament)
);

// Team management
router.post(
  '/:id/teams',
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(tournamentController.addTeam)
);
router.put(
  '/:id/teams/:teamId',
  requireTeamPermission(Permission.TEAM_UPDATE),
  asyncHandler(tournamentController.updateTeam)
);
router.delete(
  '/:id/teams/:teamId',
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(tournamentController.deleteTeam)
);
router.put(
  '/:id/teams/:teamId/pool',
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.assignTeamToPool)
);

// Player management
router.post(
  '/:id/teams/:teamId/players',
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.addPlayer)
);
router.get('/:id/teams/:teamId/players', asyncHandler(tournamentController.getPlayers));
router.put(
  '/:id/teams/:teamId/players/:playerId',
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.updatePlayer)
);
router.delete(
  '/:id/teams/:teamId/players/:playerId',
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.removePlayer)
);

// Team invitations
router.post(
  '/:id/teams/:teamId/invitations',
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.sendTeamInvitation)
);
router.get(
  '/:id/teams/:teamId/invitations',
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.getTeamInvitations)
);
router.delete(
  '/:id/teams/:teamId/invitations/:invitationId',
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.cancelTeamInvitation)
);

// User invitations (no team permission needed, just authentication)
router.get('/invitations/my', asyncHandler(tournamentController.getUserInvitations));
router.post('/invitations/:inviteToken/accept', asyncHandler(tournamentController.acceptTeamInvitation));
router.post('/invitations/:inviteToken/decline', asyncHandler(tournamentController.declineTeamInvitation));

// Bracket and match management
router.post(
  '/:id/generate-brackets',
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_BRACKETS),
  asyncHandler(tournamentController.generateBrackets)
);
router.post(
  '/:id/matches/:matchId/score',
  requireTournamentPermission(Permission.TOURNAMENT_SUBMIT_SCORES),
  asyncHandler(tournamentController.submitScore)
);

// Manual bracket management (admin only)
router.post(
  '/:id/matches',
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.createMatch)
);
router.put(
  '/:id/matches/:matchId',
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.updateMatch)
);
router.delete(
  '/:id/matches/:matchId',
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.deleteMatch)
);
router.put(
  '/:id/matches/:matchId/referee',
  requireTournamentPermission(Permission.TOURNAMENT_ASSIGN_REFEREES),
  asyncHandler(tournamentController.assignReferee)
);

// Standings
router.get('/:id/standings', asyncHandler(tournamentController.getStandings));

// Pool management
router.get('/:id/pools', asyncHandler(tournamentController.getPools));
router.get('/:id/pools/:poolId', asyncHandler(tournamentController.getPoolDetails));
router.post(
  '/:id/pools',
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.createPool)
);
router.post(
  '/:id/pools/:poolId/teams/:teamId',
  requireTeamPermission(Permission.TEAM_REGISTER_TO_POOL),
  asyncHandler(tournamentController.registerTeamToPool)
);
router.delete(
  '/:id/pools/:poolId/teams/:teamId',
  requireTeamPermission(Permission.TEAM_REGISTER_TO_POOL),
  asyncHandler(tournamentController.removeTeamFromPool)
);
router.delete(
  '/:id/pools/:poolId/waitlist/:teamId',
  requireTeamPermission(Permission.TEAM_REGISTER_TO_POOL),
  asyncHandler(tournamentController.removeTeamFromWaitlist)
);

export default router;
