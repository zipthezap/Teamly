import { Router } from 'express';
import * as communityProxyController from '../controllers/proxies/communityProxyController';
import * as teamUpProxyController from '../controllers/proxies/teamUpProxyController';
import authMiddleware from '../middleware/auth';
import {
  authenticatedLimiter,
  teamUpCommentLimiter,
  teamUpCreateLimiter,
  teamUpRespondLimiter,
  teamUpReportLimiter,
} from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireTeamUpPermission } from '../middleware/authorization';
import { Permission } from '../../shared/types/permissions.types';
import { cacheControl, noCache } from '../middleware/cacheControl';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Create a TeamUp request (authenticated users can create)
router.post('/', noCache, teamUpCreateLimiter, asyncHandler(teamUpProxyController.createTeamUpRequest));

// Get all TeamUp requests (browse with filters) - cache for 60 seconds
router.get('/', cacheControl(60, { private: true, staleWhileRevalidate: 30 }), asyncHandler(communityProxyController.getTeamUpRequests));

// Get nearby TeamUp requests - cache for 5 minutes (location queries are expensive)
router.get('/nearby', cacheControl(300, { private: true, staleWhileRevalidate: 60 }), asyncHandler(teamUpProxyController.getNearbyTeamUpRequests));

// Get user's own TeamUp requests - cache for 2 minutes
router.get('/my-requests', cacheControl(120, { private: true, staleWhileRevalidate: 30 }), asyncHandler(teamUpProxyController.getMyTeamUpRequests));

// Get applications I submitted (responder view: responses I submitted to others' requests)
router.get('/my-applications', cacheControl(60, { private: true }), asyncHandler(teamUpProxyController.getMyTeamUpApplications));

// Attendance history for current user
router.get('/attendance-history', cacheControl(60, { private: true }), asyncHandler(teamUpProxyController.getMyTeamUpAttendanceHistory));

// Saved searches
router.get('/saved-searches', cacheControl(60, { private: true }), asyncHandler(teamUpProxyController.listTeamUpSavedSearches));
router.post('/saved-searches', noCache, asyncHandler(teamUpProxyController.createTeamUpSavedSearch));
router.delete('/saved-searches/:searchId', noCache, asyncHandler(teamUpProxyController.deleteTeamUpSavedSearch));

// Operational analytics
router.get('/analytics', cacheControl(120, { private: true }), asyncHandler(teamUpProxyController.getTeamUpAnalytics));

// Moderation queue (admin)
router.get('/moderation/reports', noCache, asyncHandler(teamUpProxyController.listTeamUpModerationCases));
router.put('/moderation/reports/:caseId', noCache, asyncHandler(teamUpProxyController.updateTeamUpModerationCase));

// Get responses for user's TeamUp requests - cache for 1 minute
router.get('/my-responses', cacheControl(60, { private: true }), asyncHandler(teamUpProxyController.getMyTeamUpResponses));

// Get a specific TeamUp request - cache for 2 minutes
router.get('/:id', cacheControl(120, { private: true, staleWhileRevalidate: 30 }), asyncHandler(teamUpProxyController.getTeamUpRequest));

// Update a TeamUp request (creator only)
router.put(
  '/:id',
  noCache,
  requireTeamUpPermission(Permission.TEAMUP_UPDATE),
  asyncHandler(teamUpProxyController.updateTeamUpRequest)
);

// Delete a TeamUp request (creator only)
router.delete(
  '/:id',
  noCache,
  requireTeamUpPermission(Permission.TEAMUP_DELETE),
  asyncHandler(teamUpProxyController.deleteTeamUpRequest)
);

// Respond to a TeamUp request (authenticated users can respond)
router.post('/:id/respond', noCache, teamUpRespondLimiter, asyncHandler(teamUpProxyController.respondToTeamUpRequest));

// Withdraw my pending response to a TeamUp request
router.delete('/:id/respond', noCache, asyncHandler(teamUpProxyController.withdrawTeamUpResponse));
router.put('/:id/respond/rsvp', noCache, asyncHandler(teamUpProxyController.updateTeamUpRsvp));

// Accept or decline multiple responses in one request (must be registered before :responseId)
router.post(
  '/:id/responses/bulk-handle',
  noCache,
  requireTeamUpPermission(Permission.TEAMUP_MANAGE_RESPONSES),
  asyncHandler(teamUpProxyController.bulkHandleTeamUpResponses)
);
// Accept or decline a single response (creator only)
router.post(
  '/:id/responses/:responseId',
  noCache,
  requireTeamUpPermission(Permission.TEAMUP_MANAGE_RESPONSES),
  asyncHandler(teamUpProxyController.handleTeamUpResponse)
);
router.put(
  '/:id/responses/:responseId/attendance',
  noCache,
  requireTeamUpPermission(Permission.TEAMUP_MANAGE_RESPONSES),
  asyncHandler(teamUpProxyController.markTeamUpAttendance)
);
router.post(
  '/:id/reminders',
  noCache,
  requireTeamUpPermission(Permission.TEAMUP_MANAGE_RESPONSES),
  asyncHandler(teamUpProxyController.sendTeamUpReminderNudges)
);
router.get(
  '/:id/replacements/suggestions',
  cacheControl(30, { private: true }),
  requireTeamUpPermission(Permission.TEAMUP_MANAGE_RESPONSES),
  asyncHandler(teamUpProxyController.getTeamUpReplacementSuggestions)
);

// Get comments for a TeamUp request - cache for 1 minute
router.get('/:id/comments', cacheControl(60, { private: true }), asyncHandler(teamUpProxyController.getTeamUpComments));

// Add a comment to a TeamUp request (authenticated users can comment)
router.post('/:id/comments', noCache, teamUpCommentLimiter, asyncHandler(teamUpProxyController.addTeamUpComment));

// Delete a comment (author only)
router.delete('/:id/comments/:commentId', noCache, asyncHandler(teamUpProxyController.deleteTeamUpComment));

// Report a TeamUp request
router.post('/:id/report', noCache, teamUpReportLimiter, asyncHandler(teamUpProxyController.reportTeamUpRequest));

export default router;
