import { Router } from 'express';
import * as tournamentController from '../controllers/tournamentController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { 
  requireTournamentOrganizer,
  requireTournamentOrganizerOrGroupAdmin,
  requireTeamManagementPermission
} from '../middleware/authorization';

const router = Router();

// All tournament routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Tournament CRUD
router.post('/', asyncHandler(tournamentController.createTournament));
router.get('/', asyncHandler(tournamentController.getTournaments));
router.get('/:id', asyncHandler(tournamentController.getTournament));
router.put('/:id', requireTournamentOrganizerOrGroupAdmin, asyncHandler(tournamentController.updateTournament));
router.delete('/:id', requireTournamentOrganizerOrGroupAdmin, asyncHandler(tournamentController.deleteTournament));

// Team management
router.post('/:id/teams', asyncHandler(tournamentController.addTeam));
router.put('/:id/teams/:teamId', requireTeamManagementPermission, asyncHandler(tournamentController.updateTeam));
router.delete('/:id/teams/:teamId', requireTournamentOrganizerOrGroupAdmin, asyncHandler(tournamentController.deleteTeam));
router.put('/:id/teams/:teamId/pool', requireTournamentOrganizerOrGroupAdmin, asyncHandler(tournamentController.assignTeamToPool));

// Player management
router.post('/:id/teams/:teamId/players', requireTeamManagementPermission, asyncHandler(tournamentController.addPlayer));
router.get('/:id/teams/:teamId/players', asyncHandler(tournamentController.getPlayers));
router.put('/:id/teams/:teamId/players/:playerId', requireTeamManagementPermission, asyncHandler(tournamentController.updatePlayer));
router.delete('/:id/teams/:teamId/players/:playerId', requireTeamManagementPermission, asyncHandler(tournamentController.removePlayer));

// Bracket and match management
router.post('/:id/generate-brackets', requireTournamentOrganizerOrGroupAdmin, asyncHandler(tournamentController.generateBrackets));
router.post('/:id/matches/:matchId/score', asyncHandler(tournamentController.submitScore));

// Manual bracket management (organizer or group admin only)
router.post('/:id/matches', requireTournamentOrganizerOrGroupAdmin, asyncHandler(tournamentController.createMatch));
router.put('/:id/matches/:matchId', requireTournamentOrganizerOrGroupAdmin, asyncHandler(tournamentController.updateMatch));
router.delete('/:id/matches/:matchId', requireTournamentOrganizerOrGroupAdmin, asyncHandler(tournamentController.deleteMatch));
router.put('/:id/matches/:matchId/referee', requireTournamentOrganizerOrGroupAdmin, asyncHandler(tournamentController.assignReferee));

// Standings
router.get('/:id/standings', asyncHandler(tournamentController.getStandings));

// Pool management
router.get('/:id/pools', asyncHandler(tournamentController.getPools));
router.get('/:id/pools/:poolId', asyncHandler(tournamentController.getPoolDetails));
router.post('/:id/pools', requireTournamentOrganizerOrGroupAdmin, asyncHandler(tournamentController.createPool));
router.post('/:id/pools/:poolId/teams/:teamId', asyncHandler(tournamentController.registerTeamToPool));
router.delete('/:id/pools/:poolId/teams/:teamId', asyncHandler(tournamentController.removeTeamFromPool));
router.delete('/:id/pools/:poolId/waitlist/:teamId', asyncHandler(tournamentController.removeTeamFromWaitlist));

export default router;
