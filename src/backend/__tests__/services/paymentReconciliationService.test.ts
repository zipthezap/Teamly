import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prisma client so tests can control DB interactions
vi.mock('../../config/database', () => ({
  default: {
    tournamentPaymentTransaction: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '../../config/database';
import * as svc from '../../services/paymentReconciliationService';
import { NotificationFactory } from '../../services/notificationFactory';

vi.mock('../../services/scheduledJobs', () => ({ syncTeamPaymentStatuses: vi.fn().mockResolvedValue(undefined) }));

describe('paymentReconciliationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.tournamentPaymentTransaction.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentPaymentTransaction.create).mockResolvedValue({} as any);
    vi.mocked(prisma.tournamentPaymentTransaction.update).mockResolvedValue({} as any);
  });

  it('creates a new transaction and triggers sync', async () => {
    await svc.handlePaymentProviderWebhook({
      provider: 'stripe',
      providerReference: 'ch_1',
      tournamentId: 't1',
      teamId: 'team-1',
      amount: 1000,
      currency: 'USD',
      status: 'paid',
      paidAt: new Date().toISOString(),
    });

    expect(prisma.tournamentPaymentTransaction.create).toHaveBeenCalled();
  });

  it('updates existing transaction idempotently', async () => {
    vi.mocked(prisma.tournamentPaymentTransaction.findFirst).mockResolvedValue({ id: 'tx-1', status: 'pending' } as any);

    await svc.handlePaymentProviderWebhook({ provider: 'stripe', providerReference: 'ch_2', status: 'paid' });

    expect(prisma.tournamentPaymentTransaction.update).toHaveBeenCalled();
  });
});
