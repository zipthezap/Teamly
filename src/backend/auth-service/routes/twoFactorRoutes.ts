import { Router } from 'express';

import { disable2FA, get2FAStatus, setup2FA, verify2FA } from '../../controllers/twoFactorController';
import { requireHeaderAuth } from '../internalAuth';
import { etagMiddleware } from '../../middleware/etag';
import { noCache } from '../../middleware/cacheControl';

const router = Router();

router.use(requireHeaderAuth);

router.get('/status', etagMiddleware({ weak: true }), get2FAStatus);
router.post('/setup', noCache, setup2FA);
router.post('/verify', noCache, verify2FA);
router.post('/disable', noCache, disable2FA);

export default router;