import { Router } from 'express';

import {
	addTeamUpComment,
	bulkHandleTeamUpResponses,
	createTeamUpRequest,
	createTeamUpSavedSearch,
	deleteTeamUpRequest,
	deleteTeamUpSavedSearch,
	deleteTeamUpComment,
	getTeamUpRequests,
	handleTeamUpResponse,
	listTeamUpModerationCases,
	markTeamUpAttendance,
	reportTeamUpRequest,
	respondToTeamUpRequest,
	sendTeamUpReminderNudges,
	updateTeamUpRequest,
	updateTeamUpModerationCase,
	updateTeamUpRsvp,
	withdrawTeamUpResponse,
} from '../../controllers/teamUpController';
import { requireTeamUpPermission } from '../../middleware/authorization';
import { asyncHandler } from '../../middleware/asyncHandler';
import { Permission } from '../../../shared/types/permissions.types';
import { requireHeaderAuth } from '../headerAuth';

const router = Router();

router.get('/', requireHeaderAuth, asyncHandler(getTeamUpRequests));
router.post('/', requireHeaderAuth, asyncHandler(createTeamUpRequest));
router.post('/saved-searches', requireHeaderAuth, asyncHandler(createTeamUpSavedSearch));
router.delete('/saved-searches/:searchId', requireHeaderAuth, asyncHandler(deleteTeamUpSavedSearch));
router.put('/:id', requireHeaderAuth, requireTeamUpPermission(Permission.TEAMUP_UPDATE), asyncHandler(updateTeamUpRequest));
router.delete('/:id', requireHeaderAuth, requireTeamUpPermission(Permission.TEAMUP_DELETE), asyncHandler(deleteTeamUpRequest));
router.post('/:id/respond', requireHeaderAuth, asyncHandler(respondToTeamUpRequest));
router.delete('/:id/respond', requireHeaderAuth, asyncHandler(withdrawTeamUpResponse));
router.put('/:id/respond/rsvp', requireHeaderAuth, asyncHandler(updateTeamUpRsvp));
router.post(
	'/:id/responses/bulk-handle',
	requireHeaderAuth,
	requireTeamUpPermission(Permission.TEAMUP_MANAGE_RESPONSES),
	asyncHandler(bulkHandleTeamUpResponses),
);
router.post(
	'/:id/responses/:responseId',
	requireHeaderAuth,
	requireTeamUpPermission(Permission.TEAMUP_MANAGE_RESPONSES),
	asyncHandler(handleTeamUpResponse),
);
router.put(
	'/:id/responses/:responseId/attendance',
	requireHeaderAuth,
	requireTeamUpPermission(Permission.TEAMUP_MANAGE_RESPONSES),
	asyncHandler(markTeamUpAttendance),
);
router.post(
	'/:id/reminders',
	requireHeaderAuth,
	requireTeamUpPermission(Permission.TEAMUP_MANAGE_RESPONSES),
	asyncHandler(sendTeamUpReminderNudges),
);
router.get('/moderation/reports', requireHeaderAuth, asyncHandler(listTeamUpModerationCases));
router.put('/moderation/reports/:caseId', requireHeaderAuth, asyncHandler(updateTeamUpModerationCase));
router.post('/:id/comments', requireHeaderAuth, asyncHandler(addTeamUpComment));
router.delete('/:id/comments/:commentId', requireHeaderAuth, asyncHandler(deleteTeamUpComment));
router.post('/:id/report', requireHeaderAuth, asyncHandler(reportTeamUpRequest));

export default router;
