import { Request, Response } from 'express';
import * as paymentReconciliationService from '../services/paymentReconciliationService';
import { logger } from '../utils/logger';

export const handleWebhook = async (req: Request, res: Response) => {
  // Expect a JSON payload from payment provider
  const body = req.body as any;

  try {
    // Normalize expected fields. Different providers will have different
    // payload shapes; callers should transform to this canonical shape.
    const provider = req.headers['x-provider'] as string || body.provider || 'unknown';
    const providerReference = body.providerReference || body.id || body.transactionId;

    if (!providerReference) {
      res.status(400).json({ error: 'Missing providerReference' });
      return;
    }

    await paymentReconciliationService.handlePaymentProviderWebhook({
      provider,
      providerReference,
      tournamentId: body.tournamentId,
      teamId: body.teamId,
      amount: body.amount,
      currency: body.currency,
      status: body.status,
      paidAt: body.paidAt,
      refundedAt: body.refundedAt,
      metadata: body.metadata,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Payment webhook processing failed', 'PaymentWebhookController', { error });
    // Respond 202 when processing failed but we don't want to force retries
    res.status(202).json({ ok: false });
  }
};

export default { handleWebhook };
