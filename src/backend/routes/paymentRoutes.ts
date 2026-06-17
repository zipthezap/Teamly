import { Router } from 'express';
import { handleWebhook } from '../controllers/paymentWebhookController';

const router = Router();

// Public webhook endpoint for payment providers to notify about transactions
router.post('/webhook', handleWebhook);

export default router;
