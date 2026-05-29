import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as tournamentController from '../tournament-service/controllers/tournament';
import { proxyTournamentHandler } from '../controllers/proxies/tournamentProxyController';
import authMiddleware, { optionalAuthMiddleware } from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireTournamentPermission, requireTeamPermission } from '../middleware/authorization';
import { Permission } from '../../shared/types/permissions.types';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

const tournamentMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tournament write requests. Please try again shortly.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const requireJsonContentType = (req: Request, res: Response, next: NextFunction): void => {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    next();
    return;
  }
  const contentLengthHeader = req.headers['content-length'];
  const contentLength =
    typeof contentLengthHeader === 'string' ? Number(contentLengthHeader) : undefined;
  if (contentLengthHeader !== undefined && (contentLength === undefined || Number.isNaN(contentLength))) {
    res.status(400).json({ error: 'Invalid Content-Length header' });
    return;
  }
  if (!req.headers['content-type'] && (contentLength === undefined || contentLength === 0)) {
    next();
    return;
  }
  if (req.is('application/json')) {
    next();
    return;
  }
  res.status(415).json({ error: 'Content-Type must be application/json' });
};

router.use(requireJsonContentType);

// Public endpoint - no auth required
router.get('/public', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getPublicTournaments)));

// Public tournament portal - accessible by share token or public tournament ID, no auth required
router.get('/portal/:shareToken', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getPublicTournamentPortal)));

// Public invitation preview - no auth required (used by mobile invite page to show context before login)
router.get('/invitations/preview/:inviteToken', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getInvitationDetails)));

// Allow anyone to view team players for public discovery (no auth required)
router.get('/:id/teams/:teamId/players',
  optionalAuthMiddleware,
  etagMiddleware({ weak: true }),
  asyncHandler(proxyTournamentHandler(tournamentController.getPlayers))
);

// All tournament routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Tournament CRUD
router.post('/', noCache, tournamentMutationLimiter, asyncHandler(proxyTournamentHandler(tournamentController.createTournament)));
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data; server-side cache (Redis/in-memory) remains active
router.get('/', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getTournaments)));
router.get('/:id', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getTournament)));
router.put('/:id',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.updateTournament))
);
router.delete('/:id',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_DELETE),
  asyncHandler(proxyTournamentHandler(tournamentController.deleteTournament))
);
router.post('/:id/cancel',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.cancelTournament))
);

// Team management
router.post('/:id/teams/self-register',
  noCache,
  tournamentMutationLimiter,
  asyncHandler(proxyTournamentHandler(tournamentController.selfRegisterTeam))
);
router.delete('/:id/teams/self-register',
  noCache,
  asyncHandler(proxyTournamentHandler(tournamentController.selfUnregisterTeam))
);
router.post('/:id/teams',
  noCache,
  tournamentMutationLimiter,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(proxyTournamentHandler(tournamentController.addTeam))
);
router.put('/:id/teams/:teamId',
  noCache,
  requireTeamPermission(Permission.TEAM_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.updateTeam))
);
router.delete('/:id/teams/:teamId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(proxyTournamentHandler(tournamentController.deleteTeam))
);
// Admin: update payment status for a registered team
router.put('/:id/teams/:teamId/payment',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(proxyTournamentHandler(tournamentController.updateTeamPayment))
);
router.get('/:id/teams/:teamId/payments',
  etagMiddleware({ weak: true }),
  asyncHandler(proxyTournamentHandler(tournamentController.getTeamPaymentTransactions))
);
router.post('/:id/teams/:teamId/payments/intent',
  noCache,
  asyncHandler(proxyTournamentHandler(tournamentController.createTeamPaymentIntent))
);
router.put('/:id/payments/:paymentId/status',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(proxyTournamentHandler(tournamentController.updatePaymentTransactionStatus))
);
router.put('/:id/teams/payment/batch',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(proxyTournamentHandler(tournamentController.batchUpdateTeamPayments))
);
router.put('/:id/teams/:teamId/pool',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.assignTeamToPool))
);
// Atomically move a team from one pool to another (admin only)
router.put('/:id/teams/:teamId/pool-move',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.moveTeamToPool))
);

// Player management
router.post('/:id/teams/:teamId/players',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(proxyTournamentHandler(tournamentController.addPlayer))
);
router.put('/:id/teams/:teamId/players/:playerId',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(proxyTournamentHandler(tournamentController.updatePlayer))
);
router.delete('/:id/teams/:teamId/players/:playerId',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(proxyTournamentHandler(tournamentController.removePlayer))
);

// Team invitations
router.post('/:id/teams/:teamId/invitations',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(proxyTournamentHandler(tournamentController.sendTeamInvitation))
);
router.get('/:id/teams/:teamId/invitations',
  etagMiddleware({ weak: true }),
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(proxyTournamentHandler(tournamentController.getTeamInvitations))
);
router.delete('/:id/teams/:teamId/invitations/:invitationId',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(proxyTournamentHandler(tournamentController.cancelTeamInvitation))
);

// User invitations (no team permission needed, just authentication)
router.get('/invitations/my', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getUserInvitations)));
router.post('/invitations/:inviteToken/accept', noCache, asyncHandler(proxyTournamentHandler(tournamentController.acceptTeamInvitation)));
router.post('/invitations/:inviteToken/decline', noCache, asyncHandler(proxyTournamentHandler(tournamentController.declineTeamInvitation)));
router.get('/invitations/:inviteToken', noCache, asyncHandler(proxyTournamentHandler(tournamentController.getInvitationByToken)));

// Bracket and match management
router.get('/:id/matches', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getTournamentMatches)));
router.post('/:id/generate-group-matches',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_BRACKETS),
  asyncHandler(proxyTournamentHandler(tournamentController.generateGroupMatches))
);
router.post('/:id/generate-brackets',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_BRACKETS),
  asyncHandler(proxyTournamentHandler(tournamentController.generateBrackets))
);
router.post('/:id/matches/:matchId/score',
  noCache,
  tournamentMutationLimiter,
  requireTournamentPermission(Permission.TOURNAMENT_SUBMIT_SCORES),
  asyncHandler(proxyTournamentHandler(tournamentController.submitScore))
);
// Admin score override G�� allows organizers/admins to retroactively set or correct scores
router.put('/:id/matches/:matchId/score',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.adminUpdateScore))
);

// Manual bracket management (admin only)
router.post('/:id/matches',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.createMatch))
);
router.put('/:id/matches/:matchId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.updateMatch))
);
router.post('/:id/matches/:matchId/cancel',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.cancelMatch))
);
router.delete('/:id/matches/:matchId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.deleteMatch))
);
router.put('/:id/matches/:matchId/referee',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_ASSIGN_REFEREES),
  asyncHandler(proxyTournamentHandler(tournamentController.assignReferee))
);
router.post('/:id/matches/auto-assign-referees',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_ASSIGN_REFEREES),
  asyncHandler(proxyTournamentHandler(tournamentController.autoAssignReferees))
);
router.get('/:id/referee-duties', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getRefereeDuties)));

// Standings
router.get('/:id/standings', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getStandings)));

// Pool management
router.get('/:id/pools', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getPools)));
router.get('/:id/pools/:poolId', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getPoolDetails)));
router.post('/:id/pools',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.createPool))
);
router.put('/:id/pools/:poolId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.updatePool))
);
router.delete('/:id/pools/:poolId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.deletePool))
);
router.post('/:id/pools/:poolId/teams/:teamId',
  noCache,
  asyncHandler(proxyTournamentHandler(tournamentController.registerTeamToPool))
);

// Admin variant: allow tournament admins/organizers to register or move any team to a pool
router.post('/:id/pools/:poolId/admin/teams/:teamId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.registerTeamToPool))
);
router.delete('/:id/pools/:poolId/teams/:teamId',
  noCache,
  asyncHandler(proxyTournamentHandler(tournamentController.removeTeamFromPool))
);

// Admin variant: allow tournament admins/organizers to remove any team from a pool
router.delete('/:id/pools/:poolId/admin/teams/:teamId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.removeTeamFromPool))
);
router.delete('/:id/pools/:poolId/waitlist/:teamId',
  noCache,
  asyncHandler(proxyTournamentHandler(tournamentController.removeTeamFromWaitlist))
);

// Admin variant: allow tournament admins/organizers to remove any team from a waitlist
router.delete('/:id/pools/:poolId/waitlist/:teamId/admin',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.removeTeamFromWaitlist))
);

// Category management
router.get('/:id/categories', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getCategories)));
router.post('/:id/categories',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.createCategory))
);
router.put('/:id/categories/:categoryId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.updateCategory))
);
router.delete('/:id/categories/:categoryId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.deleteCategory))
);
router.put('/:id/pools/:poolId/category',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_POOLS),
  asyncHandler(proxyTournamentHandler(tournamentController.assignPoolToCategory))
);

// Admin delegation
router.get('/:id/admins',
  etagMiddleware({ weak: true }),
  requireTournamentPermission(Permission.TOURNAMENT_VIEW_ADMIN_PANEL),
  asyncHandler(proxyTournamentHandler(tournamentController.getAdmins))
);
router.post('/:id/admins',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.addAdmin))
);
router.delete('/:id/admins/:adminUserId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.removeAdmin))
);

// Notifications
router.get('/:id/notifications',
  etagMiddleware({ weak: true }),
  requireTournamentPermission(Permission.TOURNAMENT_VIEW_ADMIN_PANEL),
  asyncHandler(proxyTournamentHandler(tournamentController.getTournamentNotifications))
);

// Team check-in (#4)
router.put('/:id/teams/:teamId/check-in',
  noCache,
  requireTeamPermission(Permission.TEAM_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.checkInTeam))
);
// QR-based check-in (Phase 3)
router.post('/:id/teams/:teamId/check-in/token',
  noCache,
  requireTeamPermission(Permission.TEAM_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.generateCheckInQrToken))
);
// QR check-in via token G�� no auth required (token itself is the credential)
router.post('/:id/check-in/qr',
  noCache,
  asyncHandler(proxyTournamentHandler(tournamentController.checkInViaQrToken))
);
router.put('/:id/teams/:teamId/waiver',
  noCache,
  asyncHandler(proxyTournamentHandler(tournamentController.acceptTeamWaiver))
);

// Courts / venue-aware scheduling
router.get('/:id/courts', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getCourts)));
router.post('/:id/courts',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.createCourt))
);
router.put('/:id/courts/:courtId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.updateCourt))
);
router.delete('/:id/courts/:courtId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.deleteCourt))
);
router.post('/:id/courts/:courtId/availability',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.createCourtAvailability))
);
router.delete('/:id/courts/:courtId/availability/:availabilityId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.deleteCourtAvailability))
);
router.put('/:id/matches/:matchId/schedule',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.scheduleMatchOnCourt))
);
router.put('/:id/matches/bulk-shift',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.bulkShiftScheduledMatches))
);
// Scorekeeper assignment, match start, incidents (Phase 3)
router.put('/:id/matches/:matchId/scorekeeper',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.assignMatchScorekeeper))
);
// Match start: organizer/admin OR assigned scorekeeper may start G�� kept as controller-level auth
// because scorekeeper is an assigned user ID, not a tournament role in the permission matrix
router.put('/:id/matches/:matchId/start',
  noCache,
  asyncHandler(proxyTournamentHandler(tournamentController.startMatch))
);
router.get('/:id/matches/:matchId/incidents',
  etagMiddleware({ weak: true }),
  asyncHandler(proxyTournamentHandler(tournamentController.getMatchIncidents))
);
// Incident create: organizer/admin OR assigned scorekeeper G�� controller-level auth (same reason as start)
router.post('/:id/matches/:matchId/incidents',
  noCache,
  asyncHandler(proxyTournamentHandler(tournamentController.createMatchIncident))
);
router.put('/:id/incidents/:incidentId/resolve',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.resolveMatchIncident))
);

// Registration waitlist (#2)
router.get('/:id/registration-waitlist', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getRegistrationWaitlist)));
router.post('/:id/registration-waitlist', noCache, asyncHandler(proxyTournamentHandler(tournamentController.joinRegistrationWaitlist)));
router.delete('/:id/registration-waitlist', noCache, asyncHandler(proxyTournamentHandler(tournamentController.leaveRegistrationWaitlist)));
router.delete('/:id/registration-waitlist/me', noCache, asyncHandler(proxyTournamentHandler(tournamentController.leaveRegistrationWaitlist)));
router.post('/:id/registration-waitlist/:teamId/promote',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(proxyTournamentHandler(tournamentController.promoteFromRegistrationWaitlist))
);
router.delete('/:id/registration-waitlist/:teamId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_TEAMS),
  asyncHandler(proxyTournamentHandler(tournamentController.promoteFromRegistrationWaitlist))
);

// Score disputes (#3)
// Dispute create: participants of the involved teams only G�� controller-level auth (team-scoped, not tournament-level)
router.post('/:id/matches/:matchId/disputes', noCache, asyncHandler(proxyTournamentHandler(tournamentController.createScoreDispute)));
router.get('/:id/matches/:matchId/disputes',
  etagMiddleware({ weak: true }),
  asyncHandler(proxyTournamentHandler(tournamentController.getMatchDisputes))
);
router.put('/:id/disputes/:disputeId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_MANAGE_MATCHES),
  asyncHandler(proxyTournamentHandler(tournamentController.resolveScoreDispute))
);

// Announcements (#7)
router.get('/:id/announcements', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getAnnouncements)));
router.post('/:id/announcements',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.createAnnouncement))
);

// Registration fields (#9)
router.get('/:id/registration-fields', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getRegistrationFields)));
router.post('/:id/registration-fields',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.createRegistrationField))
);
router.put('/:id/registration-fields/:fieldId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.updateRegistrationField))
);
router.delete('/:id/registration-fields/:fieldId',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.deleteRegistrationField))
);
router.post('/:id/teams/:teamId/answers', noCache, asyncHandler(proxyTournamentHandler(tournamentController.submitTeamAnswers)));
router.get('/:id/teams/:teamId/answers', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getTeamAnswers)));

// Player stats (#12)
router.get('/:id/teams/:teamId/player-stats', etagMiddleware({ weak: true }), asyncHandler(proxyTournamentHandler(tournamentController.getPlayerStats)));
router.put('/:id/teams/:teamId/players/:playerId/stats',
  noCache,
  requireTeamPermission(Permission.TEAM_MANAGE_PLAYERS),
  asyncHandler(proxyTournamentHandler(tournamentController.upsertPlayerStat))
);

// Tournament clone (#14)
router.post('/:id/clone',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.cloneTournament))
);

// Phase 4: Public portal share token
router.post('/:id/share-token',
  noCache,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(proxyTournamentHandler(tournamentController.generateShareToken))
);

// Phase 5: Organizer analytics
router.get('/:id/analytics',
  etagMiddleware({ weak: true }),
  requireTournamentPermission(Permission.TOURNAMENT_VIEW_ADMIN_PANEL),
  asyncHandler(proxyTournamentHandler(tournamentController.getTournamentAnalytics))
);

export default router;
