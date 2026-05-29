import { NextFunction, Request, Response, Router } from 'express';

import * as tournamentController from '../controllers/tournament';

const router = Router();

type TournamentHandler = (req: Request, res: Response) => unknown | Promise<unknown>;

const withServiceContext = (handler: TournamentHandler) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      const userId = req.header('x-user-id');
      if (userId) {
        req.user = {
          id: userId,
          email: req.header('x-user-email') || '',
          name: req.header('x-user-name') || '',
          city: req.header('x-user-city') || null,
          country: req.header('x-user-country') || null,
        };
      }
    }

    try {
      await Promise.resolve(handler(req, res));
    } catch (error) {
      next(error);
    }
  };
};

// Keep static/public routes before dynamic :id routes to avoid shadowing.
router.get('/public', withServiceContext(tournamentController.getPublicTournaments));
router.get('/portal/:shareToken', withServiceContext(tournamentController.getPublicTournamentPortal));
router.get('/invitations/preview/:inviteToken', withServiceContext(tournamentController.getInvitationDetails));
router.get('/:id/teams/:teamId/players', withServiceContext(tournamentController.getPlayers));
router.post('/', withServiceContext(tournamentController.createTournament));
router.get('/', withServiceContext(tournamentController.getTournaments));
router.get('/:id', withServiceContext(tournamentController.getTournament));
router.put('/:id', withServiceContext(tournamentController.updateTournament));
router.delete('/:id', withServiceContext(tournamentController.deleteTournament));
router.post('/:id/cancel', withServiceContext(tournamentController.cancelTournament));
router.post('/:id/teams/self-register', withServiceContext(tournamentController.selfRegisterTeam));
router.delete('/:id/teams/self-register', withServiceContext(tournamentController.selfUnregisterTeam));
router.post('/:id/teams', withServiceContext(tournamentController.addTeam));
router.put('/:id/teams/:teamId', withServiceContext(tournamentController.updateTeam));
router.delete('/:id/teams/:teamId', withServiceContext(tournamentController.deleteTeam));
router.put('/:id/teams/:teamId/payment', withServiceContext(tournamentController.updateTeamPayment));
router.get('/:id/teams/:teamId/payments', withServiceContext(tournamentController.getTeamPaymentTransactions));
router.post('/:id/teams/:teamId/payments/intent', withServiceContext(tournamentController.createTeamPaymentIntent));
router.put('/:id/payments/:paymentId/status', withServiceContext(tournamentController.updatePaymentTransactionStatus));
router.put('/:id/teams/payment/batch', withServiceContext(tournamentController.batchUpdateTeamPayments));
router.put('/:id/teams/:teamId/pool', withServiceContext(tournamentController.assignTeamToPool));
router.put('/:id/teams/:teamId/pool-move', withServiceContext(tournamentController.moveTeamToPool));
router.post('/:id/teams/:teamId/players', withServiceContext(tournamentController.addPlayer));
router.put('/:id/teams/:teamId/players/:playerId', withServiceContext(tournamentController.updatePlayer));
router.delete('/:id/teams/:teamId/players/:playerId', withServiceContext(tournamentController.removePlayer));
router.post('/:id/teams/:teamId/invitations', withServiceContext(tournamentController.sendTeamInvitation));
router.get('/:id/teams/:teamId/invitations', withServiceContext(tournamentController.getTeamInvitations));
router.delete('/:id/teams/:teamId/invitations/:invitationId', withServiceContext(tournamentController.cancelTeamInvitation));
router.get('/invitations/my', withServiceContext(tournamentController.getUserInvitations));
router.post('/invitations/:inviteToken/accept', withServiceContext(tournamentController.acceptTeamInvitation));
router.post('/invitations/:inviteToken/decline', withServiceContext(tournamentController.declineTeamInvitation));
router.get('/invitations/:inviteToken', withServiceContext(tournamentController.getInvitationByToken));
router.get('/:id/matches', withServiceContext(tournamentController.getTournamentMatches));
router.post('/:id/generate-group-matches', withServiceContext(tournamentController.generateGroupMatches));
router.post('/:id/generate-brackets', withServiceContext(tournamentController.generateBrackets));
router.post('/:id/matches/:matchId/score', withServiceContext(tournamentController.submitScore));
router.put('/:id/matches/:matchId/score', withServiceContext(tournamentController.adminUpdateScore));
router.post('/:id/matches', withServiceContext(tournamentController.createMatch));
router.put('/:id/matches/:matchId', withServiceContext(tournamentController.updateMatch));
router.post('/:id/matches/:matchId/cancel', withServiceContext(tournamentController.cancelMatch));
router.delete('/:id/matches/:matchId', withServiceContext(tournamentController.deleteMatch));
router.put('/:id/matches/:matchId/referee', withServiceContext(tournamentController.assignReferee));
router.post('/:id/matches/auto-assign-referees', withServiceContext(tournamentController.autoAssignReferees));
router.get('/:id/referee-duties', withServiceContext(tournamentController.getRefereeDuties));
router.get('/:id/standings', withServiceContext(tournamentController.getStandings));
router.get('/:id/pools', withServiceContext(tournamentController.getPools));
router.get('/:id/pools/:poolId', withServiceContext(tournamentController.getPoolDetails));
router.post('/:id/pools', withServiceContext(tournamentController.createPool));
router.put('/:id/pools/:poolId', withServiceContext(tournamentController.updatePool));
router.delete('/:id/pools/:poolId', withServiceContext(tournamentController.deletePool));
router.post('/:id/pools/:poolId/teams/:teamId', withServiceContext(tournamentController.registerTeamToPool));
router.post('/:id/pools/:poolId/admin/teams/:teamId', withServiceContext(tournamentController.registerTeamToPool));
router.delete('/:id/pools/:poolId/teams/:teamId', withServiceContext(tournamentController.removeTeamFromPool));
router.delete('/:id/pools/:poolId/admin/teams/:teamId', withServiceContext(tournamentController.removeTeamFromPool));
router.delete('/:id/pools/:poolId/waitlist/:teamId', withServiceContext(tournamentController.removeTeamFromWaitlist));
router.delete('/:id/pools/:poolId/waitlist/:teamId/admin', withServiceContext(tournamentController.removeTeamFromWaitlist));
router.get('/:id/categories', withServiceContext(tournamentController.getCategories));
router.post('/:id/categories', withServiceContext(tournamentController.createCategory));
router.put('/:id/categories/:categoryId', withServiceContext(tournamentController.updateCategory));
router.delete('/:id/categories/:categoryId', withServiceContext(tournamentController.deleteCategory));
router.put('/:id/pools/:poolId/category', withServiceContext(tournamentController.assignPoolToCategory));
router.get('/:id/admins', withServiceContext(tournamentController.getAdmins));
router.post('/:id/admins', withServiceContext(tournamentController.addAdmin));
router.delete('/:id/admins/:adminUserId', withServiceContext(tournamentController.removeAdmin));
router.get('/:id/notifications', withServiceContext(tournamentController.getTournamentNotifications));
router.put('/:id/teams/:teamId/check-in', withServiceContext(tournamentController.checkInTeam));
router.post('/:id/teams/:teamId/check-in/token', withServiceContext(tournamentController.generateCheckInQrToken));
router.post('/:id/check-in/qr', withServiceContext(tournamentController.checkInViaQrToken));
router.put('/:id/teams/:teamId/waiver', withServiceContext(tournamentController.acceptTeamWaiver));
router.get('/:id/courts', withServiceContext(tournamentController.getCourts));
router.post('/:id/courts', withServiceContext(tournamentController.createCourt));
router.put('/:id/courts/:courtId', withServiceContext(tournamentController.updateCourt));
router.delete('/:id/courts/:courtId', withServiceContext(tournamentController.deleteCourt));
router.post('/:id/courts/:courtId/availability', withServiceContext(tournamentController.createCourtAvailability));
router.delete('/:id/courts/:courtId/availability/:availabilityId', withServiceContext(tournamentController.deleteCourtAvailability));
router.put('/:id/matches/:matchId/schedule', withServiceContext(tournamentController.scheduleMatchOnCourt));
router.put('/:id/matches/bulk-shift', withServiceContext(tournamentController.bulkShiftScheduledMatches));
router.put('/:id/matches/:matchId/scorekeeper', withServiceContext(tournamentController.assignMatchScorekeeper));
router.put('/:id/matches/:matchId/start', withServiceContext(tournamentController.startMatch));
router.get('/:id/matches/:matchId/incidents', withServiceContext(tournamentController.getMatchIncidents));
router.post('/:id/matches/:matchId/incidents', withServiceContext(tournamentController.createMatchIncident));
router.put('/:id/incidents/:incidentId/resolve', withServiceContext(tournamentController.resolveMatchIncident));
router.get('/:id/registration-waitlist', withServiceContext(tournamentController.getRegistrationWaitlist));
router.post('/:id/registration-waitlist', withServiceContext(tournamentController.joinRegistrationWaitlist));
router.delete('/:id/registration-waitlist', withServiceContext(tournamentController.leaveRegistrationWaitlist));
router.delete('/:id/registration-waitlist/me', withServiceContext(tournamentController.leaveRegistrationWaitlist));
router.post('/:id/registration-waitlist/:teamId/promote', withServiceContext(tournamentController.promoteFromRegistrationWaitlist));
router.delete('/:id/registration-waitlist/:teamId', withServiceContext(tournamentController.promoteFromRegistrationWaitlist));
router.post('/:id/matches/:matchId/disputes', withServiceContext(tournamentController.createScoreDispute));
router.get('/:id/matches/:matchId/disputes', withServiceContext(tournamentController.getMatchDisputes));
router.put('/:id/disputes/:disputeId', withServiceContext(tournamentController.resolveScoreDispute));
router.get('/:id/announcements', withServiceContext(tournamentController.getAnnouncements));
router.post('/:id/announcements', withServiceContext(tournamentController.createAnnouncement));
router.get('/:id/registration-fields', withServiceContext(tournamentController.getRegistrationFields));
router.post('/:id/registration-fields', withServiceContext(tournamentController.createRegistrationField));
router.put('/:id/registration-fields/:fieldId', withServiceContext(tournamentController.updateRegistrationField));
router.delete('/:id/registration-fields/:fieldId', withServiceContext(tournamentController.deleteRegistrationField));
router.post('/:id/teams/:teamId/answers', withServiceContext(tournamentController.submitTeamAnswers));
router.get('/:id/teams/:teamId/answers', withServiceContext(tournamentController.getTeamAnswers));
router.get('/:id/teams/:teamId/player-stats', withServiceContext(tournamentController.getPlayerStats));
router.put('/:id/teams/:teamId/players/:playerId/stats', withServiceContext(tournamentController.upsertPlayerStat));
router.post('/:id/clone', withServiceContext(tournamentController.cloneTournament));
router.post('/:id/share-token', withServiceContext(tournamentController.generateShareToken));
router.get('/:id/analytics', withServiceContext(tournamentController.getTournamentAnalytics));

export default router;
