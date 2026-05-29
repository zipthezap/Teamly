import { Router } from 'express';

import {
	cancelMyJoinRequest,
	createGroup,
	deleteGroup,
	bulkInviteMembers,
	generateGroupInviteToken,
	generateInviteToken,
	getInviteLink,
	getJoinRequests,
	getPublicGroups,
	handleJoinRequest,
	inviteMember,
	joinGroupByInviteToken,
	leaveGroup,
	removeMember,
	removeMemberByUserId,
	respondToInvitation,
	revokeInvitation,
	requestJoinGroup,
	transferAdmin,
	updateGroup,
	updateMemberRole,
} from '../../controllers/groupController';
import { asyncHandler } from '../../middleware/asyncHandler';
import { optionalHeaderAuth, requireHeaderAuth } from '../headerAuth';

const router = Router();

router.get('/public', optionalHeaderAuth, asyncHandler(getPublicGroups));
router.post('/', requireHeaderAuth, asyncHandler(createGroup));
router.put('/:id', requireHeaderAuth, asyncHandler(updateGroup));
router.delete('/:id', requireHeaderAuth, asyncHandler(deleteGroup));
router.post('/:id/invite', requireHeaderAuth, asyncHandler(inviteMember));
router.post('/:id/invitations/bulk', requireHeaderAuth, asyncHandler(bulkInviteMembers));
router.post('/:id/invitations/revoke', requireHeaderAuth, asyncHandler(revokeInvitation));
router.post('/:id/invitations/generate-token', requireHeaderAuth, asyncHandler(generateInviteToken));
router.get('/:id/invite-link', requireHeaderAuth, asyncHandler(getInviteLink));
router.post('/:id/invite-token', requireHeaderAuth, asyncHandler(generateGroupInviteToken));
router.post('/join-by-token/:token', requireHeaderAuth, asyncHandler(joinGroupByInviteToken));
router.post('/:id/join-request', requireHeaderAuth, asyncHandler(requestJoinGroup));
router.get('/:id/join-requests', requireHeaderAuth, asyncHandler(getJoinRequests));
router.post('/:id/join-requests/:requestId', requireHeaderAuth, asyncHandler(handleJoinRequest));
router.delete('/:id/join-requests/:requestId', requireHeaderAuth, asyncHandler(cancelMyJoinRequest));
router.delete('/:id/members/:memberId', requireHeaderAuth, asyncHandler(removeMember));
router.delete('/:id/members/user/:userId', requireHeaderAuth, asyncHandler(removeMemberByUserId));
router.put('/:id/members/:memberId/role', requireHeaderAuth, asyncHandler(updateMemberRole));
router.delete('/:id/leave', requireHeaderAuth, asyncHandler(leaveGroup));
router.post('/:id/transfer-admin', requireHeaderAuth, asyncHandler(transferAdmin));
router.post('/:id/invitations/:requestId/respond', requireHeaderAuth, asyncHandler(respondToInvitation));

export default router;
