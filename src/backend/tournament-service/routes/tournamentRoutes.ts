import { Router } from 'express';

import {
  getPublicTournaments,
  getTournamentMatches,
  getTournamentMatchCount,
  getStandings,
  getTournamentSummary,
} from '../controllers/tournamentController';
import {
  acceptTeamInvitation,
  cancelTeamInvitation,
  declineTeamInvitation,
  getInvitationByToken,
  getInvitationDetails,
  getTeamInvitations,
  getUserInvitations,
  sendTeamInvitation,
} from '../controllers/invitationController';
import { cancelMatch } from '../controllers/matchGameDayController';

const router = Router();

router.get('/public', getPublicTournaments);
router.get('/invitations/preview/:inviteToken', getInvitationDetails);
router.get('/invitations/my', getUserInvitations);
router.post('/invitations/:inviteToken/accept', acceptTeamInvitation);
router.post('/invitations/:inviteToken/decline', declineTeamInvitation);
router.get('/invitations/:inviteToken', getInvitationByToken);

router.post('/:id/teams/:teamId/invitations', sendTeamInvitation);
router.get('/:id/teams/:teamId/invitations', getTeamInvitations);
router.delete('/:id/teams/:teamId/invitations/:invitationId', cancelTeamInvitation);
router.post('/:id/matches/:matchId/cancel', cancelMatch);

router.get('/:id/summary', getTournamentSummary);
router.get('/:id/matches', getTournamentMatches);
router.get('/:id/standings', getStandings);
router.get('/:id/match-count', getTournamentMatchCount);

export default router;
