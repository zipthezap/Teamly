import { Router } from 'express';

import {
  deleteTeamUpRequestAdmin,
  resendInviteNotifications,
  updateTeamUpStatusAdmin,
} from '../../controllers/adminController';
import { requireHeaderAuth } from '../headerAuth';
import { authenticatedLimiter } from '../../middleware/rateLimiter';

const router = Router();

router.use(requireHeaderAuth);
router.use(authenticatedLimiter);

router.post('/invite-resend', resendInviteNotifications);
router.delete('/teamup/:id', deleteTeamUpRequestAdmin);
router.put('/teamup/:id/status', updateTeamUpStatusAdmin);

export default router;