const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/auth');
const { authenticatedLimiter } = require('../middleware/rateLimiter');


// Public join via invite link (no auth)
router.post('/join', groupController.joinGroupByInvite);

// Public route to get all public groups
router.get('/public', groupController.getPublicGroups);

router.use(authMiddleware);
router.use(authenticatedLimiter);

router.post('/', groupController.createGroup);
router.get('/', groupController.getGroups);
router.get('/:id', groupController.getGroup);
router.put('/:id', groupController.updateGroup);
router.post('/:id/invite', groupController.inviteMember);
router.delete('/:id/members/:memberId', groupController.removeMember);

// Join request routes
router.post('/:id/join-request', groupController.requestJoinGroup);
router.get('/:id/join-requests', groupController.getJoinRequests);
router.post('/:id/join-requests/:requestId', groupController.handleJoinRequest);

module.exports = router;
