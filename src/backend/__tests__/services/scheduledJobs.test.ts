import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma from '../../config/database';
import {
  checkIncidentSlas,
  runCleanupTasks,
  sendDueEventReminders,
  sendTournamentPaymentDeadlineReminders,
} from '../../services/scheduledJobs';

vi.mock('../../config/database', () => ({
  default: {
    groupJoinRequest: {
      updateMany: vi.fn(),
    },
    inviteLog: {
      updateMany: vi.fn(),
    },
    teamUpRequest: {
      updateMany: vi.fn(),
    },
    sessionReminder: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    tournamentMatchIncident: {
      findMany: vi.fn(),
    },
    tournamentNotification: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    tournament: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../utils/jwt', () => ({
  cleanupExpiredTokens: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/emailQueueService', () => ({
  cleanupOldEmails: vi.fn().mockResolvedValue(undefined),
  sendEmailWithQueue: vi.fn().mockResolvedValue(undefined),
}));

import { cleanupExpiredTokens } from '../../utils/jwt';
import { cleanupOldEmails, sendEmailWithQueue } from '../../services/emailQueueService';

const db = prisma as unknown as {
  groupJoinRequest: { updateMany: ReturnType<typeof vi.fn> };
  inviteLog: { updateMany: ReturnType<typeof vi.fn> };
  teamUpRequest: { updateMany: ReturnType<typeof vi.fn> };
  sessionReminder: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  tournamentMatchIncident: {
    findMany: ReturnType<typeof vi.fn>;
  };
  tournamentNotification: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  tournament: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe('scheduledJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.tournamentMatchIncident.findMany.mockResolvedValue([]);
    db.tournamentNotification.findFirst.mockResolvedValue(null);
    db.tournamentNotification.create.mockResolvedValue({});
    db.tournament.findMany.mockResolvedValue([]);
  });

  // ─── runCleanupTasks ───────────────────────────────────────────────────────
  describe('runCleanupTasks', () => {
    it('calls cleanupExpiredTokens', async () => {
      db.groupJoinRequest.updateMany.mockResolvedValue({ count: 0 });
      db.inviteLog.updateMany.mockResolvedValue({ count: 0 });
      db.teamUpRequest.updateMany.mockResolvedValue({ count: 0 });

      await runCleanupTasks();

      expect(cleanupExpiredTokens).toHaveBeenCalledOnce();
    });

    it('calls cleanupOldEmails', async () => {
      db.groupJoinRequest.updateMany.mockResolvedValue({ count: 0 });
      db.inviteLog.updateMany.mockResolvedValue({ count: 0 });
      db.teamUpRequest.updateMany.mockResolvedValue({ count: 0 });

      await runCleanupTasks();

      expect(cleanupOldEmails).toHaveBeenCalledOnce();
    });

    it('expires group invitations and join requests via expireInvitesAndJoinRequests', async () => {
      db.groupJoinRequest.updateMany.mockResolvedValue({ count: 3 });
      db.inviteLog.updateMany.mockResolvedValue({ count: 2 });
      db.teamUpRequest.updateMany.mockResolvedValue({ count: 1 });

      await runCleanupTasks();

      // updateMany called twice: once for INVITE sourced, once for USER sourced
      expect(db.groupJoinRequest.updateMany).toHaveBeenCalledTimes(2);
      expect(db.inviteLog.updateMany).toHaveBeenCalledOnce();
      expect(db.teamUpRequest.updateMany).toHaveBeenCalledOnce();
    });

    it('does not throw when cleanup tasks fail', async () => {
      vi.mocked(cleanupExpiredTokens).mockRejectedValueOnce(new Error('DB error'));

      await expect(runCleanupTasks()).resolves.not.toThrow();
    });
  });

  // ─── sendDueEventReminders ─────────────────────────────────────────────────
  describe('sendDueEventReminders', () => {
    const makeReminder = (overrides: Record<string, unknown> = {}) => ({
      id: 'reminder-1',
      sessionId: 'session-1',
      userId: 'user-1',
      remindAt: new Date(),
      sent: false,
      session: {
        id: 'session-1',
        title: 'Weekly Match',
        startTime: new Date('2025-03-01T10:00:00Z'),
        location: 'Central Park',
      },
      user: {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        emailNotifications: true,
      },
      ...overrides,
    });

    it('sends an email for each pending reminder when emailNotifications is true', async () => {
      db.sessionReminder.findMany.mockResolvedValue([makeReminder(), makeReminder({ id: 'reminder-2' })]);
      db.sessionReminder.update.mockResolvedValue({});

      await sendDueEventReminders();

      expect(sendEmailWithQueue).toHaveBeenCalledTimes(2);
    });

    it('marks each reminder as sent after processing', async () => {
      db.sessionReminder.findMany.mockResolvedValue([makeReminder()]);
      db.sessionReminder.update.mockResolvedValue({});

      await sendDueEventReminders();

      expect(db.sessionReminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reminder-1' },
          data: { sent: true },
        })
      );
    });

    it('skips email when user has emailNotifications disabled', async () => {
      db.sessionReminder.findMany.mockResolvedValue([
        makeReminder({ user: { id: 'user-1', name: 'Bob', email: 'bob@example.com', emailNotifications: false } }),
      ]);
      db.sessionReminder.update.mockResolvedValue({});

      await sendDueEventReminders();

      expect(sendEmailWithQueue).not.toHaveBeenCalled();
      // Reminder should still be marked sent
      expect(db.sessionReminder.update).toHaveBeenCalledOnce();
    });

    it('is a no-op when there are no pending reminders', async () => {
      db.sessionReminder.findMany.mockResolvedValue([]);

      await sendDueEventReminders();

      expect(sendEmailWithQueue).not.toHaveBeenCalled();
      expect(db.sessionReminder.update).not.toHaveBeenCalled();
    });

    it('does not throw when no reminders are due', async () => {
      db.sessionReminder.findMany.mockResolvedValue([]);
      await expect(sendDueEventReminders()).resolves.not.toThrow();
    });
  });

  describe('checkIncidentSlas', () => {
    it('creates a notification for overdue incidents that have not been notified yet', async () => {
      db.tournamentMatchIncident.findMany.mockResolvedValue([
        {
          id: 'incident-1',
          tournamentId: 'tournament-1',
          matchId: 'match-1',
          tournament: { id: 'tournament-1', name: 'Summer Cup', organizerId: 'user-1' },
        },
      ]);
      db.tournamentNotification.findFirst.mockResolvedValue(null);

      await checkIncidentSlas();

      expect(db.tournamentNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            tournamentId: 'tournament-1',
          }),
        })
      );
    });
  });

  describe('sendTournamentPaymentDeadlineReminders', () => {
    it('creates payment reminders for overdue unpaid teams', async () => {
      db.tournament.findMany.mockResolvedValue([
        {
          id: 'tournament-1',
          name: 'Summer Cup',
          paymentDeadline: new Date('2025-01-01T00:00:00Z'),
          teams: [{ id: 'team-1', captainUserId: 'captain-1' }],
        },
      ]);
      db.tournamentNotification.findFirst.mockResolvedValue(null);

      await sendTournamentPaymentDeadlineReminders();

      expect(db.tournamentNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'captain-1',
            tournamentId: 'tournament-1',
            type: 'payment_reminder',
          }),
        })
      );
    });
  });
});
