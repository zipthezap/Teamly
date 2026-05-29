import { Router } from 'express';

import {
	archiveEvent,
	generateEventInviteToken,
	generateInviteToken,
	getEvents,
	inviteToEvent,
	joinEvent,
	leaveEvent,
	removeGuestParticipant,
	revokeEventInvitation,
	unarchiveEvent,
	updateGuestParticipant,
	updateGuestParticipantStatus,
	updateParticipationStatus,
	updateSessionStatus,
} from '../../controllers/sessionController';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireHeaderAuth } from '../headerAuth';

const router = Router();

router.get('/', requireHeaderAuth, asyncHandler(getEvents));
router.post('/:id/join', requireHeaderAuth, asyncHandler(joinEvent));
router.delete('/:id/leave', requireHeaderAuth, asyncHandler(leaveEvent));
router.put('/:id/status', requireHeaderAuth, asyncHandler(updateParticipationStatus));
router.put('/:id/guests/:guestId', requireHeaderAuth, asyncHandler(updateGuestParticipant));
router.put('/:id/guests/:guestId/status', requireHeaderAuth, asyncHandler(updateGuestParticipantStatus));
router.delete('/:id/guests/:guestId', requireHeaderAuth, asyncHandler(removeGuestParticipant));
router.post('/:id/invite', requireHeaderAuth, asyncHandler(inviteToEvent));
router.post('/:id/invitations/revoke', requireHeaderAuth, asyncHandler(revokeEventInvitation));
router.post('/:id/invitations/generate-token', requireHeaderAuth, asyncHandler(generateEventInviteToken));
router.post('/:id/generate-invite', requireHeaderAuth, asyncHandler(generateInviteToken));
router.put('/:id/session-status', requireHeaderAuth, asyncHandler(updateSessionStatus));
router.post('/:id/archive', requireHeaderAuth, asyncHandler(archiveEvent));
router.post('/:id/unarchive', requireHeaderAuth, asyncHandler(unarchiveEvent));

export default router;
