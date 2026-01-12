import { Router } from 'express';
import * as tournamentController from '../controllers/tournamentController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';

const router = Router();

// All tournament routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Tournament CRUD
router.post('/', tournamentController.createTournament);
router.get('/', tournamentController.getTournaments);
router.get('/:id', tournamentController.getTournament);
router.put('/:id', tournamentController.updateTournament);
router.delete('/:id', tournamentController.deleteTournament);

// Team management
router.post('/:id/teams', tournamentController.addTeam);
router.put('/:id/teams/:teamId', tournamentController.updateTeam);
router.delete('/:id/teams/:teamId', tournamentController.deleteTeam);

// Bracket and match management
router.post('/:id/generate-brackets', tournamentController.generateBrackets);
router.post('/:id/matches/:matchId/score', tournamentController.submitScore);

// Standings
router.get('/:id/standings', tournamentController.getStandings);

export default router;
