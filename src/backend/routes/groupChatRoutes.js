const express = require('express');
const router = express.Router();
const chat = require('../controllers/groupChatController');
const auth = require('../middleware/auth');

router.use(auth);

// Group chat
router.post('/message', chat.createMessage);
router.get('/:groupId/messages', chat.getMessages);

// Mark late
router.post('/event/late', chat.markLate);

// Notifications
router.get('/notifications', chat.getNotifications);
router.post('/notifications/mark-read', chat.markNotificationsRead);

module.exports = router;
