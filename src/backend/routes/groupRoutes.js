const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/auth');
const { authenticatedLimiter } = require('../middleware/rateLimiter');


// Public join via invite link (no auth)
router.post('/join', groupController.joinGroupByInvite);

router.use(authMiddleware);
router.use(authenticatedLimiter);

router.post('/', groupController.createGroup);
router.get('/', groupController.getGroups);
router.get('/:id', groupController.getGroup);
router.put('/:id', groupController.updateGroup);
router.post('/:id/invite', groupController.inviteMember);
router.delete('/:id/members/:memberId', groupController.removeMember);

module.exports = router;
