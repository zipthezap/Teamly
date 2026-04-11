import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import * as leagueController from '../controllers/leagueController';

const router = Router();

router.use(authMiddleware);
router.use(authenticatedLimiter);

router.get('/', asyncHandler(leagueController.getLeagues));
router.post('/', asyncHandler(leagueController.createLeague));
router.get('/:id', asyncHandler(leagueController.getLeagueById));
router.put('/:id', asyncHandler(leagueController.updateLeague));
router.delete('/:id', asyncHandler(leagueController.deleteLeague));

router.post('/:id/teams', asyncHandler(leagueController.addTeam));
router.delete('/:id/teams/:teamId', asyncHandler(leagueController.removeTeam));

router.get('/:id/standings', asyncHandler(leagueController.getStandings));
router.post('/:id/sessions', asyncHandler(leagueController.linkSession));
router.put('/:id/matches/:matchId', asyncHandler(leagueController.updateMatch));

export default router;
