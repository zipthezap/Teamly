import { Router } from 'express';
import * as tournamentController from '../controllers/tournamentController';
import authMiddleware, { optionalAuthMiddleware } from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireTournamentPermission, requireTeamPermission } from '../middleware/authorization';
import { Permission } from '../../shared/types/permissions.types';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// Public endpoint - no auth required
router.get('/public', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getPublicTournaments));

// Public tournament portal - accessible by share token or public tournament ID, no auth required
router.get('/portal/:shareToken', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getPublicTournamentPortal));

// Public invitation preview — no auth required (used by mobile invite page to show context before login)
router.get('/invitations/preview/:inviteToken', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getInvitationDetails));

// Allow anyone to view team players for public discovery (no auth required)
router.get(
  '/:id/teams/:teamId/players',
  optionalAuthMiddleware,
  etagMiddleware({ weak: true }),
  asyncHandler(tournamentController.getPlayers)
);

// All tournament routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Tournament CRUD
router.post('/', noCache, asyncHandler(tournamentController.createTournament));
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data; server-side cache (Redis/in-memory) remains active
router.get('/', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getTournaments));
router.get('/:id', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getTournament));
router.put(
  '/:id',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.updateTournament)
);
router.delete(
  '/:id',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_DELETE),
  asyncHandler(tournamentController.deleteTournament)
);
router.post(
  '/:id/cancel',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.cancelTournament)
);

// Team management
router.post(
  '/:id/teams/self-register',
  noCache,
  asyncHandler(tournamentController.selfRegisterTeam)
);
router.delete(
  '/:id/teams/self-register',
  noCache,
  asyncHandler(tournamentController.selfUnregisterTeam)
);
router.post(
  '/:id/teams',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(tournamentController.addTeam)
);
router.put(
  '/:id/teams/:teamId',
  noCache,
  requireTeamPermission(Permission.TEAM_UPDATE),
  asyncHandler(tournamentController.updateTeam)
);
router.delete(
  '/:id/teams/:teamId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(tournamentController.deleteTeam)
);
// Admin: update payment status for a registered team
router.put(
  '/:id/teams/:teamId/payment',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(tournamentController.updateTeamPayment)
);
router.get(
  '/:id/teams/:teamId/payments',
  etagMiddleware({ weak: true }),
  asyncHandler(tournamentController.getTeamPaymentTransactions)
);
router.post(
  '/:id/teams/:teamId/payments/intent',
  noCache,
  asyncHandler(tournamentController.createTeamPaymentIntent)
);
router.put(
  '/:id/payments/:paymentId/status',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(tournamentController.updatePaymentTransactionStatus)
);
router.put(
  '/:id/teams/payment/batch',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(tournamentController.batchUpdateTeamPayments)
);
router.put(
  '/:id/teams/:teamId/pool',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.assignTeamToPool)
);
// Atomically move a team from one pool to another (admin only)
router.put(
  '/:id/teams/:teamId/pool-move',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.moveTeamToPool)
);

// Player management
router.post(
  '/:id/teams/:teamId/players',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.addPlayer)
);
router.put(
  '/:id/teams/:teamId/players/:playerId',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.updatePlayer)
);
router.delete(
  '/:id/teams/:teamId/players/:playerId',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.removePlayer)
);

// Team invitations
router.post(
  '/:id/teams/:teamId/invitations',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.sendTeamInvitation)
);
router.get(
  '/:id/teams/:teamId/invitations',
  etagMiddleware({ weak: true }),
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.getTeamInvitations)
);
router.delete(
  '/:id/teams/:teamId/invitations/:invitationId',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.cancelTeamInvitation)
);

// User invitations (no team permission needed, just authentication)
router.get('/invitations/my', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getUserInvitations));
router.post('/invitations/:inviteToken/accept', noCache, asyncHandler(tournamentController.acceptTeamInvitation));
router.post('/invitations/:inviteToken/decline', noCache, asyncHandler(tournamentController.declineTeamInvitation));
router.get('/invitations/:inviteToken', noCache, asyncHandler(tournamentController.getInvitationByToken));

// Bracket and match management
router.get('/:id/matches', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getTournamentMatches));
router.post(
  '/:id/generate-group-matches',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_BRACKETS),
  asyncHandler(tournamentController.generateGroupMatches)
);
router.post(
  '/:id/generate-brackets',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_BRACKETS),
  asyncHandler(tournamentController.generateBrackets)
);
router.post(
  '/:id/matches/:matchId/score',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_SUBMIT_SCORES),
  asyncHandler(tournamentController.submitScore)
);
// Admin score override — allows organizers/admins to retroactively set or correct scores
router.put(
  '/:id/matches/:matchId/score',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.adminUpdateScore)
);

// Manual bracket management (admin only)
router.post(
  '/:id/matches',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.createMatch)
);
router.put(
  '/:id/matches/:matchId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.updateMatch)
);
router.post(
  '/:id/matches/:matchId/cancel',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.cancelMatch)
);
router.delete(
  '/:id/matches/:matchId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.deleteMatch)
);
router.put(
  '/:id/matches/:matchId/referee',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_ASSIGN_REFEREES),
  asyncHandler(tournamentController.assignReferee)
);
router.post(
  '/:id/matches/auto-assign-referees',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_ASSIGN_REFEREES),
  asyncHandler(tournamentController.autoAssignReferees)
);
router.get('/:id/referee-duties', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getRefereeDuties));

// Standings
router.get('/:id/standings', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getStandings));

// Pool management
router.get('/:id/pools', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getPools));
router.get('/:id/pools/:poolId', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getPoolDetails));
router.post(
  '/:id/pools',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.createPool)
);
router.put(
  '/:id/pools/:poolId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.updatePool)
);
router.delete(
  '/:id/pools/:poolId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.deletePool)
);
router.post(
  '/:id/pools/:poolId/teams/:teamId',
  noCache,
  asyncHandler(tournamentController.registerTeamToPool)
);

// Admin variant: allow tournament admins/organizers to register or move any team to a pool
router.post(
  '/:id/pools/:poolId/admin/teams/:teamId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.registerTeamToPool)
);

// Admin: move a team from one pool to another (deprecated path; remove after mobile/web migration by 2026-09-30)
// Prefer PUT /:id/teams/:teamId/pool-move for new clients.
router.post(
  '/:id/pools/:poolId/admin/teams/:teamId/move/:targetPoolId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.moveTeamToPool)
);
router.delete(
  '/:id/pools/:poolId/teams/:teamId',
  noCache,
  asyncHandler(tournamentController.removeTeamFromPool)
);

// Admin variant: allow tournament admins/organizers to remove any team from a pool
router.delete(
  '/:id/pools/:poolId/admin/teams/:teamId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.removeTeamFromPool)
);
router.delete(
  '/:id/pools/:poolId/waitlist/:teamId',
  noCache,
  asyncHandler(tournamentController.removeTeamFromWaitlist)
);

// Admin variant: allow tournament admins/organizers to remove any team from a waitlist
router.delete(
  '/:id/pools/:poolId/waitlist/:teamId/admin',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.removeTeamFromWaitlist)
);

// Category management
router.get('/:id/categories', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getCategories));
router.post(
  '/:id/categories',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.createCategory)
);
router.put(
  '/:id/categories/:categoryId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.updateCategory)
);
router.delete(
  '/:id/categories/:categoryId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.deleteCategory)
);
router.put(
  '/:id/pools/:poolId/category',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(tournamentController.assignPoolToCategory)
);

// Admin delegation
router.get(
  '/:id/admins',
  etagMiddleware({ weak: true }),
  requireTournamentPermission(Permission.TOURNAMENT_VIEW_ADMIN_PANEL),
  asyncHandler(tournamentController.getAdmins)
);
router.post(
  '/:id/admins',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.addAdmin)
);
router.delete(
  '/:id/admins/:adminUserId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.removeAdmin)
);

// Notifications
router.get(
  '/:id/notifications',
  etagMiddleware({ weak: true }),
  requireTournamentPermission(Permission.TOURNAMENT_VIEW_ADMIN_PANEL),
  asyncHandler(tournamentController.getTournamentNotifications)
);

// Team check-in (#4)
router.put(
  '/:id/teams/:teamId/check-in',
  noCache,
  requireTeamPermission(Permission.TEAM_UPDATE),
  asyncHandler(tournamentController.checkInTeam)
);
// QR-based check-in (Phase 3)
router.post(
  '/:id/teams/:teamId/check-in/token',
  noCache,
  requireTeamPermission(Permission.TEAM_UPDATE),
  asyncHandler(tournamentController.generateCheckInQrToken)
);
// QR check-in via token — no auth required (token itself is the credential)
router.post(
  '/:id/check-in/qr',
  noCache,
  asyncHandler(tournamentController.checkInViaQrToken)
);
router.put(
  '/:id/teams/:teamId/waiver',
  noCache,
  asyncHandler(tournamentController.acceptTeamWaiver)
);

// Courts / venue-aware scheduling
router.get('/:id/courts', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getCourts));
router.post(
  '/:id/courts',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.createCourt)
);
router.put(
  '/:id/courts/:courtId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.updateCourt)
);
router.delete(
  '/:id/courts/:courtId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.deleteCourt)
);
router.post(
  '/:id/courts/:courtId/availability',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.createCourtAvailability)
);
router.delete(
  '/:id/courts/:courtId/availability/:availabilityId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.deleteCourtAvailability)
);
router.put(
  '/:id/matches/:matchId/schedule',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.scheduleMatchOnCourt)
);
router.put(
  '/:id/matches/bulk-shift',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.bulkShiftScheduledMatches)
);
// Scorekeeper assignment, match start, incidents (Phase 3)
router.put(
  '/:id/matches/:matchId/scorekeeper',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.assignMatchScorekeeper)
);
// Match start: organizer/admin OR assigned scorekeeper may start — kept as controller-level auth
// because scorekeeper is an assigned user ID, not a tournament role in the permission matrix
router.put(
  '/:id/matches/:matchId/start',
  noCache,
  asyncHandler(tournamentController.startMatch)
);
router.get(
  '/:id/matches/:matchId/incidents',
  etagMiddleware({ weak: true }),
  asyncHandler(tournamentController.getMatchIncidents)
);
// Incident create: organizer/admin OR assigned scorekeeper — controller-level auth (same reason as start)
router.post(
  '/:id/matches/:matchId/incidents',
  noCache,
  asyncHandler(tournamentController.createMatchIncident)
);
router.put(
  '/:id/incidents/:incidentId/resolve',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.resolveMatchIncident)
);

// Registration waitlist (#2)
router.get('/:id/registration-waitlist', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getRegistrationWaitlist));
router.post('/:id/registration-waitlist', noCache, asyncHandler(tournamentController.joinRegistrationWaitlist));
router.delete('/:id/registration-waitlist', noCache, asyncHandler(tournamentController.leaveRegistrationWaitlist));
router.delete('/:id/registration-waitlist/me', noCache, asyncHandler(tournamentController.leaveRegistrationWaitlist));
router.post(
  '/:id/registration-waitlist/:teamId/promote',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(tournamentController.promoteFromRegistrationWaitlist)
);
router.delete(
  '/:id/registration-waitlist/:teamId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(tournamentController.promoteFromRegistrationWaitlist)
);

// Score disputes (#3)
// Dispute create: participants of the involved teams only — controller-level auth (team-scoped, not tournament-level)
router.post('/:id/matches/:matchId/disputes', noCache, asyncHandler(tournamentController.createScoreDispute));
router.get(
  '/:id/matches/:matchId/disputes',
  etagMiddleware({ weak: true }),
  asyncHandler(tournamentController.getMatchDisputes)
);
router.put(
  '/:id/disputes/:disputeId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(tournamentController.resolveScoreDispute)
);

// Announcements (#7)
router.get('/:id/announcements', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getAnnouncements));
router.post(
  '/:id/announcements',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.createAnnouncement)
);

// Registration fields (#9)
router.get('/:id/registration-fields', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getRegistrationFields));
router.post(
  '/:id/registration-fields',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.createRegistrationField)
);
router.put(
  '/:id/registration-fields/:fieldId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.updateRegistrationField)
);
router.delete(
  '/:id/registration-fields/:fieldId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.deleteRegistrationField)
);
router.post('/:id/teams/:teamId/answers', noCache, asyncHandler(tournamentController.submitTeamAnswers));
router.get('/:id/teams/:teamId/answers', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getTeamAnswers));

// Player stats (#12)
router.get('/:id/teams/:teamId/player-stats', etagMiddleware({ weak: true }), asyncHandler(tournamentController.getPlayerStats));
router.put(
  '/:id/teams/:teamId/players/:playerId/stats',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(tournamentController.upsertPlayerStat)
);

// Tournament clone (#14)
router.post(
  '/:id/clone',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.cloneTournament)
);

// Phase 4: Public portal share token
router.post(
  '/:id/share-token',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.generateShareToken)
);

// Phase 5: Organizer analytics
router.get(
  '/:id/analytics',
  etagMiddleware({ weak: true }),
  requireTournamentPermission(Permission.TOURNAMENT_VIEW_ADMIN_PANEL),
  asyncHandler(tournamentController.getTournamentAnalytics)
);

export default router;
