/**
 * Notification Helper Utility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  shouldSendEmailNotification,
  isNotificationMuted,
  batchIsNotificationMuted,
  filterUnmutedUsers,
  shouldSendPushNotification,
  batchShouldSendEmailNotification,
} from '../../utils/notificationHelper';
import prisma from '../../config/database';

vi.mock('../../config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    emailPreference: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as {
  user: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  emailPreference: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

// ─── shouldSendEmailNotification ───────────────────────────────────────────

describe('shouldSendEmailNotification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false when the user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await shouldSendEmailNotification('u1', 'sessionInvites')).toBe(false);
  });

  it('returns false when user.emailNotifications is false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: false });
    expect(await shouldSendEmailNotification('u1', 'sessionInvites')).toBe(false);
  });

  it('returns true when emailNotifications is true and no preference row exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue(null);
    expect(await shouldSendEmailNotification('u1', 'sessionInvites')).toBe(true);
  });

  it('returns false when preference row has the field set to false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue({ sessionInvites: false });
    expect(await shouldSendEmailNotification('u1', 'sessionInvites')).toBe(false);
  });

  it('returns true when preference row has the field set to true', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue({ sessionInvites: true });
    expect(await shouldSendEmailNotification('u1', 'sessionInvites')).toBe(true);
  });

  it('returns false on DB error', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db error'));
    expect(await shouldSendEmailNotification('u1', 'sessionInvites')).toBe(false);
  });
});

// ─── isNotificationMuted ────────────────────────────────────────────────────

describe('isNotificationMuted', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false when no preference row exists', async () => {
    mockPrisma.emailPreference.findUnique.mockResolvedValue(null);
    expect(await isNotificationMuted('u1', 'muteSessionInvites')).toBe(false);
  });

  it('returns true when the mute field is true', async () => {
    mockPrisma.emailPreference.findUnique.mockResolvedValue({ muteSessionInvites: true });
    expect(await isNotificationMuted('u1', 'muteSessionInvites')).toBe(true);
  });

  it('returns false when the mute field is false', async () => {
    mockPrisma.emailPreference.findUnique.mockResolvedValue({ muteSessionInvites: false });
    expect(await isNotificationMuted('u1', 'muteSessionInvites')).toBe(false);
  });

  it('returns false on DB error', async () => {
    mockPrisma.emailPreference.findUnique.mockRejectedValue(new Error('db error'));
    expect(await isNotificationMuted('u1', 'muteSessionInvites')).toBe(false);
  });
});

// ─── batchIsNotificationMuted ───────────────────────────────────────────────

describe('batchIsNotificationMuted', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an empty Map for an empty userIds array', async () => {
    mockPrisma.emailPreference.findMany.mockResolvedValue([]);
    const result = await batchIsNotificationMuted([], 'muteSessionInvites');
    expect(result.size).toBe(0);
  });

  it('returns false for all users when no preferences exist', async () => {
    mockPrisma.emailPreference.findMany.mockResolvedValue([]);
    const result = await batchIsNotificationMuted(['u1', 'u2'], 'muteSessionInvites');
    expect(result.get('u1')).toBe(false);
    expect(result.get('u2')).toBe(false);
  });

  it('returns correct mute values when some users have preferences', async () => {
    mockPrisma.emailPreference.findMany.mockResolvedValue([
      { userId: 'u1', muteSessionInvites: true },
      { userId: 'u2', muteSessionInvites: false },
    ]);
    const result = await batchIsNotificationMuted(['u1', 'u2', 'u3'], 'muteSessionInvites');
    expect(result.get('u1')).toBe(true);
    expect(result.get('u2')).toBe(false);
    expect(result.get('u3')).toBe(false); // no preference row → not muted
  });

  it('returns an empty Map on DB error', async () => {
    mockPrisma.emailPreference.findMany.mockRejectedValue(new Error('db error'));
    const result = await batchIsNotificationMuted(['u1'], 'muteSessionInvites');
    expect(result.size).toBe(0);
  });
});

// ─── filterUnmutedUsers ─────────────────────────────────────────────────────

describe('filterUnmutedUsers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an empty array when all users are muted', async () => {
    mockPrisma.emailPreference.findMany.mockResolvedValue([
      { userId: 'u1', muteSessionInvites: true },
      { userId: 'u2', muteSessionInvites: true },
    ]);
    const result = await filterUnmutedUsers(['u1', 'u2'], 'muteSessionInvites');
    expect(result).toEqual([]);
  });

  it('returns all users when none are muted', async () => {
    mockPrisma.emailPreference.findMany.mockResolvedValue([
      { userId: 'u1', muteSessionInvites: false },
      { userId: 'u2', muteSessionInvites: false },
    ]);
    const result = await filterUnmutedUsers(['u1', 'u2'], 'muteSessionInvites');
    expect(result).toEqual(['u1', 'u2']);
  });

  it('returns only unmuted users when some are muted', async () => {
    mockPrisma.emailPreference.findMany.mockResolvedValue([
      { userId: 'u1', muteSessionInvites: true },
      { userId: 'u2', muteSessionInvites: false },
    ]);
    const result = await filterUnmutedUsers(['u1', 'u2'], 'muteSessionInvites');
    expect(result).toEqual(['u2']);
  });

  it('returns the original array on DB error', async () => {
    mockPrisma.emailPreference.findMany.mockRejectedValue(new Error('db error'));
    const result = await filterUnmutedUsers(['u1', 'u2'], 'muteSessionInvites');
    expect(result).toEqual(['u1', 'u2']);
  });
});

// ─── shouldSendPushNotification ─────────────────────────────────────────────

describe('shouldSendPushNotification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false when the user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.emailPreference.findUnique.mockResolvedValue(null);
    expect(await shouldSendPushNotification('u1', 'session')).toBe(false);
  });

  it('returns false when user.emailNotifications is false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: false });
    mockPrisma.emailPreference.findUnique.mockResolvedValue(null);
    expect(await shouldSendPushNotification('u1', 'session')).toBe(false);
  });

  it('returns false when preference pushEnabled is false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue({ pushEnabled: false });
    expect(await shouldSendPushNotification('u1', 'session')).toBe(false);
  });

  it('returns false for session channel when pushSessions is false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue({
      pushEnabled: true,
      pushSessions: false,
    });
    expect(await shouldSendPushNotification('u1', 'session')).toBe(false);
  });

  it('returns true for session channel when pushSessions is true', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue({
      pushEnabled: true,
      pushSessions: true,
    });
    expect(await shouldSendPushNotification('u1', 'session')).toBe(true);
  });

  it('returns false for group channel when pushGroups is false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue({
      pushEnabled: true,
      pushGroups: false,
    });
    expect(await shouldSendPushNotification('u1', 'group')).toBe(false);
  });

  it('returns true for group channel when pushGroups is true', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue({
      pushEnabled: true,
      pushGroups: true,
    });
    expect(await shouldSendPushNotification('u1', 'group')).toBe(true);
  });

  it('returns true for teamup channel when pushTeamUp is true', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue({
      pushEnabled: true,
      pushTeamUp: true,
    });
    expect(await shouldSendPushNotification('u1', 'teamup')).toBe(true);
  });

  it('returns false for tournament channel when pushTournaments is false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue({
      pushEnabled: true,
      pushTournaments: false,
    });
    expect(await shouldSendPushNotification('u1', 'tournament')).toBe(false);
  });

  it('defaults to true for all channels when no preference row exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailNotifications: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue(null);

    for (const channel of ['session', 'group', 'teamup', 'tournament'] as const) {
      expect(await shouldSendPushNotification('u1', channel)).toBe(true);
    }
  });
});

// ─── batchShouldSendEmailNotification ──────────────────────────────────────

describe('batchShouldSendEmailNotification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false for a user with emailNotifications=false', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', emailNotifications: false },
    ]);
    mockPrisma.emailPreference.findMany.mockResolvedValue([]);

    const result = await batchShouldSendEmailNotification(['u1'], 'sessionInvites');
    expect(result.get('u1')).toBe(false);
  });

  it('returns false for a user not present in the users result', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]); // u1 not returned
    mockPrisma.emailPreference.findMany.mockResolvedValue([]);

    const result = await batchShouldSendEmailNotification(['u1'], 'sessionInvites');
    expect(result.get('u1')).toBe(false);
  });

  it('returns false when user has emailNotifications=true but preference field is false', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', emailNotifications: true },
    ]);
    mockPrisma.emailPreference.findMany.mockResolvedValue([
      { userId: 'u1', sessionInvites: false },
    ]);

    const result = await batchShouldSendEmailNotification(['u1'], 'sessionInvites');
    expect(result.get('u1')).toBe(false);
  });

  it('returns true when user has emailNotifications=true and no preference row', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', emailNotifications: true },
    ]);
    mockPrisma.emailPreference.findMany.mockResolvedValue([]);

    const result = await batchShouldSendEmailNotification(['u1'], 'sessionInvites');
    expect(result.get('u1')).toBe(true);
  });

  it('returns an empty Map on DB error', async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error('db error'));
    const result = await batchShouldSendEmailNotification(['u1'], 'sessionInvites');
    expect(result.size).toBe(0);
  });
});
