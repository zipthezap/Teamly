import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { noCache } from '../middleware/cacheControl';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import {
  disableAllPushDevicesEndpoint,
  disablePushDeviceEndpoint,
  listPushDevices,
  refreshPushDevice,
  registerPushDevice,
} from '../controllers/pushTokenController';

const router = Router();

router.use(authMiddleware);
router.use(authenticatedLimiter);

router.get('/', listPushDevices);
router.post('/', noCache, registerPushDevice);
router.put('/refresh', noCache, refreshPushDevice);
router.delete('/', noCache, disablePushDeviceEndpoint);
router.delete('/all', noCache, disableAllPushDevicesEndpoint);

export default router;
