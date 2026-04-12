/**
 * Session Validation Service Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  validateSingleDay,
  validateRequiredFields,
  validateGroupMembership,
  validateEventCreator,
  validateSessionStatus,
  validateEventCapacity,
  validateVoteThreshold,
  validateVoteDeadline,
} from '../../services/sessionValidation';

// ─── validateSingleDay ──────────────────────────────────────────────────────

describe('validateSingleDay', () => {
  it('returns valid when start and end are on the same day with valid times', () => {
    const result = validateSingleDay(
      '2024-06-15T10:00:00.000Z',
      '2024-06-15T12:00:00.000Z'
    );
    expect(result.isValid).toBe(true);
  });

  it('returns invalid when start and end are on different days', () => {
    const result = validateSingleDay(
      '2024-06-15T10:00:00.000Z',
      '2024-06-16T10:00:00.000Z'
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/single-day/i);
  });

  it('returns invalid when end is before start on the same day', () => {
    const result = validateSingleDay(
      '2024-06-15T12:00:00.000Z',
      '2024-06-15T10:00:00.000Z'
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/after start time/i);
  });

  it('returns valid when no endTime is provided', () => {
    const result = validateSingleDay('2024-06-15T10:00:00.000Z');
    expect(result.isValid).toBe(true);
  });

  it('returns invalid when endTime equals startTime', () => {
    const result = validateSingleDay(
      '2024-06-15T10:00:00.000Z',
      '2024-06-15T10:00:00.000Z'
    );
    expect(result.isValid).toBe(false);
  });
});

// ─── validateRequiredFields ─────────────────────────────────────────────────

describe('validateRequiredFields', () => {
  const validData = {
    groupId: 'group-1',
    title: 'My Session',
    sessionType: 'football',
    startTime: '2024-06-15T10:00:00.000Z',
  };

  it('returns valid when all required fields are present', () => {
    expect(validateRequiredFields(validData).isValid).toBe(true);
  });

  it('returns invalid when groupId is missing', () => {
    const { groupId: _, ...rest } = validData;
    expect(validateRequiredFields(rest).isValid).toBe(false);
  });

  it('returns invalid when title is missing', () => {
    const { title: _, ...rest } = validData;
    expect(validateRequiredFields(rest).isValid).toBe(false);
  });

  it('returns invalid when sessionType is missing', () => {
    const { sessionType: _, ...rest } = validData;
    expect(validateRequiredFields(rest).isValid).toBe(false);
  });

  it('returns invalid when startTime is missing', () => {
    const { startTime: _, ...rest } = validData;
    expect(validateRequiredFields(rest).isValid).toBe(false);
  });

  it('returns invalid when all fields are missing', () => {
    expect(validateRequiredFields({}).isValid).toBe(false);
  });
});

// ─── validateGroupMembership ────────────────────────────────────────────────

describe('validateGroupMembership', () => {
  it('returns valid when the user is a group member', async () => {
    const mockPrisma = {
      groupMember: {
        findFirst: vi.fn().mockResolvedValue({ id: 'member-1', groupId: 'g1', userId: 'u1' }),
      },
    };
    const result = await validateGroupMembership('g1', 'u1', mockPrisma);
    expect(result.isValid).toBe(true);
  });

  it('returns invalid when the user is not a group member', async () => {
    const mockPrisma = {
      groupMember: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const result = await validateGroupMembership('g1', 'u1', mockPrisma);
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/members can create/i);
  });
});

// ─── validateEventCreator ───────────────────────────────────────────────────

describe('validateEventCreator', () => {
  it('returns valid when the user is the session creator', async () => {
    const mockPrisma = {
      session: {
        findUnique: vi.fn().mockResolvedValue({ creatorId: 'user-1' }),
      },
    };
    const result = await validateEventCreator('session-1', 'user-1', mockPrisma);
    expect(result.isValid).toBe(true);
  });

  it('returns invalid when the user is not the session creator', async () => {
    const mockPrisma = {
      session: {
        findUnique: vi.fn().mockResolvedValue({ creatorId: 'user-2' }),
      },
    };
    const result = await validateEventCreator('session-1', 'user-1', mockPrisma);
    expect(result.isValid).toBe(false);
  });

  it('returns invalid when session is not found', async () => {
    const mockPrisma = {
      session: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const result = await validateEventCreator('session-1', 'user-1', mockPrisma);
    expect(result.isValid).toBe(false);
  });
});

// ─── validateSessionStatus ──────────────────────────────────────────────────

describe('validateSessionStatus', () => {
  it.each(['upcoming', 'ongoing', 'completed', 'cancelled'])(
    'returns valid for status "%s"',
    (status) => {
      expect(validateSessionStatus(status).isValid).toBe(true);
    }
  );

  it.each(['invalid', 'UPCOMING', '', 'pending'])(
    'returns invalid for status "%s"',
    (status) => {
      expect(validateSessionStatus(status).isValid).toBe(false);
    }
  );
});

// ─── validateEventCapacity ──────────────────────────────────────────────────

describe('validateEventCapacity', () => {
  it('returns valid when maxPlayers is null', () => {
    expect(validateEventCapacity(5, null).isValid).toBe(true);
  });

  it('returns valid when maxPlayers is undefined', () => {
    expect(validateEventCapacity(5, undefined).isValid).toBe(true);
  });

  it('returns valid when currentParticipants is below capacity', () => {
    expect(validateEventCapacity(5, 10).isValid).toBe(true);
  });

  it('returns invalid when at capacity (equal)', () => {
    expect(validateEventCapacity(10, 10).isValid).toBe(false);
  });

  it('returns invalid when over capacity', () => {
    expect(validateEventCapacity(11, 10).isValid).toBe(false);
  });
});

// ─── validateVoteThreshold ──────────────────────────────────────────────────

describe('validateVoteThreshold', () => {
  it.each([0, 0.5, 1])('returns valid for threshold %s', (t) => {
    expect(validateVoteThreshold(t).isValid).toBe(true);
  });

  it.each([-0.1, 1.1])('returns invalid for out-of-range threshold %s', (t) => {
    expect(validateVoteThreshold(t).isValid).toBe(false);
  });

  it('returns invalid for NaN', () => {
    expect(validateVoteThreshold(NaN).isValid).toBe(false);
  });

  it('returns invalid for a non-numeric string', () => {
    expect(validateVoteThreshold('not-a-number').isValid).toBe(false);
  });

  it('returns valid for a numeric string like "0.5"', () => {
    expect(validateVoteThreshold('0.5').isValid).toBe(true);
  });
});

// ─── validateVoteDeadline ───────────────────────────────────────────────────

describe('validateVoteDeadline', () => {
  it('returns valid for a future deadline that is before the event start', () => {
    const now = Date.now();
    const deadline = new Date(now + 1 * 60 * 60 * 1000).toISOString();      // +1 h
    const eventStart = new Date(now + 2 * 60 * 60 * 1000).toISOString();    // +2 h
    expect(validateVoteDeadline(deadline, eventStart).isValid).toBe(true);
  });

  it('returns invalid for a deadline in the past', () => {
    const now = Date.now();
    const deadline = new Date(now - 1 * 60 * 60 * 1000).toISOString();      // -1 h
    const eventStart = new Date(now + 2 * 60 * 60 * 1000).toISOString();    // +2 h
    const result = validateVoteDeadline(deadline, eventStart);
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/future/i);
  });

  it('returns invalid when deadline is after the event start', () => {
    const now = Date.now();
    const eventStart = new Date(now + 1 * 60 * 60 * 1000).toISOString();    // +1 h
    const deadline = new Date(now + 2 * 60 * 60 * 1000).toISOString();      // +2 h
    const result = validateVoteDeadline(deadline, eventStart);
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/before session start/i);
  });

  it('returns invalid for an invalid date string', () => {
    const result = validateVoteDeadline('not-a-date', '2024-06-15T10:00:00.000Z');
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });
});
