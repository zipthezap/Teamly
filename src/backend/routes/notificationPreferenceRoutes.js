const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notificationPref = require('../controllers/notificationPreferenceController');

router.get('/', auth, notificationPref.getNotificationPreferences);
router.put('/', auth, notificationPref.updateNotificationPreferences);

module.exports = router;
