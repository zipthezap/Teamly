import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import * as leagueController from '../controllers/leagueController';

const router = Router();

router.use(authMiddleware);
router.use(authenticatedLimiter);

router.get('/', leagueController.getLeagues);
router.post('/', leagueController.createLeague);
router.get('/:id', leagueController.getLeagueById);
router.put('/:id', leagueController.updateLeague);
router.delete('/:id', leagueController.deleteLeague);

router.post('/:id/teams', leagueController.addTeam);
router.delete('/:id/teams/:teamId', leagueController.removeTeam);

router.get('/:id/standings', leagueController.getStandings);
router.post('/:id/sessions', leagueController.linkSession);
router.put('/:id/matches/:matchId', leagueController.updateMatch);

export default router;
