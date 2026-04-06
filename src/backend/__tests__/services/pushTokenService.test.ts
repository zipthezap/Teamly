import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    pushDeviceToken: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import prisma from '../../config/database';
import {
  disableInvalidPushTokens,
  registerOrUpdatePushDevice,
  validatePushToken,
} from '../../services/pushTokenService';

const mockPrisma = vi.mocked(prisma);

describe('pushTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates token format', () => {
    expect(validatePushToken('abc.DEF_123:xyz')).toBe(true);
    expect(validatePushToken('')).toBe(false);
    expect(validatePushToken('bad token with spaces')).toBe(false);
  });

  it('upserts token for same user', async () => {
    mockPrisma.pushDeviceToken.findUnique.mockResolvedValue(null as never);
    mockPrisma.pushDeviceToken.upsert.mockResolvedValue({
      id: 'd1',
      token: 'tok',
      userId: 'u1',
      platform: 'android',
      enabled: true,
      locale: null,
      timezone: null,
      appVersion: null,
      deviceModel: null,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await registerOrUpdatePushDevice({
      userId: 'u1',
      token: 'tok',
      platform: 'android',
    });

    expect(result.id).toBe('d1');
    expect(mockPrisma.pushDeviceToken.upsert).toHaveBeenCalled();
  });

  it('disables invalid tokens in bulk', async () => {
    mockPrisma.pushDeviceToken.updateMany.mockResolvedValue({ count: 2 } as never);
    await disableInvalidPushTokens(['a', 'b']);
    expect(mockPrisma.pushDeviceToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: { in: ['a', 'b'] } },
        data: expect.objectContaining({ enabled: false }),
      })
    );
  });
});
