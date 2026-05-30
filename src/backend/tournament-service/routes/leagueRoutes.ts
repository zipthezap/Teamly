import { Router } from 'express';

import {
  addTeam,
  createLeague,
  deleteLeague,
  getLeagueById,
  getLeagues,
  getStandings,
  linkSession,
  removeTeam,
  updateLeague,
  updateMatch,
} from '../../controllers/leagueController';
import { requireHeaderAuth } from '../headerAuth';

const router = Router();

router.use(requireHeaderAuth);

router.get('/', getLeagues);
router.post('/', createLeague);
router.get('/:id', getLeagueById);
router.put('/:id', updateLeague);
router.delete('/:id', deleteLeague);
router.post('/:id/teams', addTeam);
router.delete('/:id/teams/:teamId', removeTeam);
router.get('/:id/standings', getStandings);
router.post('/:id/sessions', linkSession);
router.put('/:id/matches/:matchId', updateMatch);

export default router;