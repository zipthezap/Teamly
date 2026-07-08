import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { TournamentPaymentTransactionStatus } from '../../shared/types/tournament.types';
import { syncTeamPaymentStatuses } from './scheduledJobs';

/**
 * Handle provider webhook payloads to reconcile payment transactions.
 * - Uses `provider` + `providerReference` as an idempotency key where possible.
 * - Creates or updates `tournamentPaymentTransaction` rows and triggers
 *   a payment status sync which will in turn auto-promote waitlist entries.
 */
export const handlePaymentProviderWebhook = async (input: {
  provider: string;
  providerReference: string;
  tournamentId?: string | null;
  teamId?: string | null;
  amount?: number;
  currency?: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded' | 'cancelled';
  paidAt?: string | Date | null;
  refundedAt?: string | Date | null;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  const {
    provider,
    providerReference,
    tournamentId,
    teamId,
    amount,
    currency,
    status,
    paidAt,
    refundedAt,
  } = input;

  try {
    // Map external status to internal enum
    const mappedStatus = (() => {
      switch (status) {
        case 'paid': return TournamentPaymentTransactionStatus.PAID;
        case 'pending': return TournamentPaymentTransactionStatus.PENDING;
        case 'failed': return TournamentPaymentTransactionStatus.FAILED;
        case 'refunded': return TournamentPaymentTransactionStatus.REFUNDED;
        case 'cancelled': return TournamentPaymentTransactionStatus.CANCELLED;
        default: return TournamentPaymentTransactionStatus.PENDING;
      }
    })();

    // Check for existing transaction by provider + reference
    const existing = await prisma.tournamentPaymentTransaction.findFirst({
      where: { provider, providerReference },
    });

    if (existing) {
      // Idempotent update: only change fields that are different
      const updates: Record<string, unknown> = {};
      if (existing.status !== mappedStatus) updates.status = mappedStatus;
      if (mappedStatus === TournamentPaymentTransactionStatus.PAID && paidAt) updates.paidAt = new Date(paidAt as string);
      if (mappedStatus === TournamentPaymentTransactionStatus.REFUNDED && refundedAt) updates.refundedAt = new Date(refundedAt as string);

      if (Object.keys(updates).length > 0) {
        await prisma.tournamentPaymentTransaction.update({ where: { id: existing.id }, data: updates as unknown as Prisma.TournamentPaymentTransactionUpdateInput });
      } else {
        logger.debug('Payment webhook received but no updates required', 'PaymentReconciliation', { provider, providerReference });
      }
    } else {
      // Create new transaction record
      await prisma.tournamentPaymentTransaction.create({
        data: {
          tournamentId: tournamentId || undefined,
          teamId: teamId || undefined,
          createdByUserId: 'system',
          provider,
          providerReference,
          amount: amount ?? 0,
          currency: currency ?? 'USD',
          status: mappedStatus,
          paidAt: mappedStatus === TournamentPaymentTransactionStatus.PAID && paidAt ? new Date(paidAt as string) : undefined,
          refundedAt: mappedStatus === TournamentPaymentTransactionStatus.REFUNDED && refundedAt ? new Date(refundedAt as string) : undefined,
        }
      });
    }

    // Trigger a sync to ensure team payment statuses and waitlist promotions
    // are evaluated promptly. This is best-effort and errors should not
    // crash webhook processing.
    try {
      await syncTeamPaymentStatuses();
    } catch (syncErr) {
      logger.error('Failed to sync team payment statuses after webhook', 'PaymentReconciliation', { err: syncErr });
    }
  } catch (error) {
    logger.error('Error handling payment provider webhook', 'PaymentReconciliation', { error, provider, providerReference });
    throw error;
  }
};

export default { handlePaymentProviderWebhook };
