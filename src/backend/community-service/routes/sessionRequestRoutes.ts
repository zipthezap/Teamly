import { Router } from 'express';

import {
  cancelEventRequest,
  createEventRequest,
  finalizeEventRequest,
  getEventRequest,
  getEventRequestStatistics,
  getEventRequests,
  voteOnEventRequest,
} from '../../controllers/sessionRequestController';
import { requireHeaderAuth } from '../headerAuth';
import { etagMiddleware } from '../../middleware/etag';
import { noCache } from '../../middleware/cacheControl';

const router = Router();

router.use(requireHeaderAuth);

router.post('/', noCache, createEventRequest);
router.get('/group/:groupId', etagMiddleware({ weak: true }), getEventRequests);
router.get('/:id', etagMiddleware({ weak: true }), getEventRequest);
router.get('/:id/statistics', etagMiddleware({ weak: true }), getEventRequestStatistics);
router.post('/:id/vote', noCache, voteOnEventRequest);
router.post('/:id/finalize', noCache, finalizeEventRequest);
router.post('/:id/cancel', noCache, cancelEventRequest);

export default router;