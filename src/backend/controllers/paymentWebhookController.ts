import { Request, Response } from 'express';
import * as paymentReconciliationService from '../services/paymentReconciliationService';
import { logger } from '../utils/logger';

export const handleWebhook = async (req: Request, res: Response) => {
  // Expect a JSON payload from payment provider
  const body = req.body as Record<string, unknown>;

  try {
    // Normalize expected fields. Different providers will have different
    // payload shapes; callers should transform to this canonical shape.
    const provider = (req.headers['x-provider'] as string) || (body['provider'] as string) || 'unknown';
    const providerReference = (body['providerReference'] as string) || (body['id'] as string) || (body['transactionId'] as string);

    if (!providerReference) {
      res.status(400).json({ error: 'Missing providerReference' });
      return;
    }

    await paymentReconciliationService.handlePaymentProviderWebhook({
      provider,
      providerReference,
      tournamentId: body['tournamentId'] as string | undefined,
      teamId: body['teamId'] as string | undefined,
      amount: body['amount'] as number | undefined,
      currency: body['currency'] as string | undefined,
      status: (body['status'] as 'paid' | 'pending' | 'failed' | 'refunded' | 'cancelled' | undefined) ?? 'pending',
      paidAt: body['paidAt'] as string | undefined,
      refundedAt: body['refundedAt'] as string | undefined,
      metadata: body['metadata'] as Record<string, unknown> | undefined,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Payment webhook processing failed', 'PaymentWebhookController', { error });
    // Respond 202 when processing failed but we don't want to force retries
    res.status(202).json({ ok: false });
  }
};

export default { handleWebhook };
