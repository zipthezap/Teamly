import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import * as leagueProxyController from '../controllers/proxies/leagueProxyController';

const router = Router();

router.use(authMiddleware);
router.use(authenticatedLimiter);

router.get('/', leagueProxyController.getLeagues);
router.post('/', leagueProxyController.createLeague);
router.get('/:id', leagueProxyController.getLeagueById);
router.put('/:id', leagueProxyController.updateLeague);
router.delete('/:id', leagueProxyController.deleteLeague);

router.post('/:id/teams', leagueProxyController.addTeam);
router.delete('/:id/teams/:teamId', leagueProxyController.removeTeam);

router.get('/:id/standings', leagueProxyController.getStandings);
router.post('/:id/sessions', leagueProxyController.linkSession);
router.put('/:id/matches/:matchId', leagueProxyController.updateMatch);

export default router;
