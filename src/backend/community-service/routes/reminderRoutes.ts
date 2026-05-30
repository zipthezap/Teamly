import { Router } from 'express';

import { deleteReminder, getUserReminders, updateReminder } from '../../controllers/reminderController';
import { requireHeaderAuth } from '../headerAuth';
import { etagMiddleware } from '../../middleware/etag';
import { noCache } from '../../middleware/cacheControl';

const router = Router();

router.use(requireHeaderAuth);

router.get('/', etagMiddleware({ weak: true }), getUserReminders);
router.put('/:reminderId', noCache, updateReminder);
router.delete('/:reminderId', noCache, deleteReminder);

export default router;