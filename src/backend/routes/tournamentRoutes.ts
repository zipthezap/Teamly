import { Router } from 'express';
import * as tournamentController from '../controllers/tournamentController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// All tournament routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Tournament CRUD
router.post('/', asyncHandler(tournamentController.createTournament));
router.get('/', asyncHandler(tournamentController.getTournaments));
router.get('/:id', asyncHandler(tournamentController.getTournament));
router.put('/:id', asyncHandler(tournamentController.updateTournament));
router.delete('/:id', asyncHandler(tournamentController.deleteTournament));

// Team management
router.post('/:id/teams', asyncHandler(tournamentController.addTeam));
router.put('/:id/teams/:teamId', asyncHandler(tournamentController.updateTeam));
router.delete('/:id/teams/:teamId', asyncHandler(tournamentController.deleteTeam));
router.put('/:id/teams/:teamId/pool', asyncHandler(tournamentController.assignTeamToPool));

// Player management
router.post('/:id/teams/:teamId/players', asyncHandler(tournamentController.addPlayer));
router.get('/:id/teams/:teamId/players', asyncHandler(tournamentController.getPlayers));
router.put('/:id/teams/:teamId/players/:playerId', asyncHandler(tournamentController.updatePlayer));
router.delete('/:id/teams/:teamId/players/:playerId', asyncHandler(tournamentController.removePlayer));

// Bracket and match management
router.post('/:id/generate-brackets', asyncHandler(tournamentController.generateBrackets));
router.post('/:id/matches/:matchId/score', asyncHandler(tournamentController.submitScore));

// Manual bracket management (admin only)
router.post('/:id/matches', asyncHandler(tournamentController.createMatch));
router.put('/:id/matches/:matchId', asyncHandler(tournamentController.updateMatch));
router.delete('/:id/matches/:matchId', asyncHandler(tournamentController.deleteMatch));
router.put('/:id/matches/:matchId/referee', asyncHandler(tournamentController.assignReferee));

// Standings
router.get('/:id/standings', asyncHandler(tournamentController.getStandings));

export default router;
