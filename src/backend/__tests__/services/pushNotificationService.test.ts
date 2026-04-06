import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    eventNotification: { count: vi.fn() },
    groupNotification: { count: vi.fn() },
    teamUpNotification: { count: vi.fn() },
    tournamentNotification: { count: vi.fn() },
  },
}));

vi.mock('../../utils/notificationHelper', () => ({
  shouldSendPushNotification: vi.fn(async () => true),
}));

vi.mock('../../services/pushTokenService', () => ({
  getActivePushDevicesForUsers: vi.fn(async () => [
    { token: 'short', userId: 'u1', platform: 'android' },
    { token: 'valid-token-1234567890', userId: 'u1', platform: 'android' },
  ]),
  disableInvalidPushTokens: vi.fn(async () => undefined),
}));

import prisma from '../../config/database';
import { dispatchPushNotifications } from '../../services/pushNotificationService';
import { disableInvalidPushTokens } from '../../services/pushTokenService';

const mockPrisma = vi.mocked(prisma);

describe('pushNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FCM_PROJECT_ID = '';
    process.env.FCM_SERVICE_ACCOUNT_JSON = '';
    mockPrisma.eventNotification.count.mockResolvedValue(1 as never);
    mockPrisma.groupNotification.count.mockResolvedValue(2 as never);
    mockPrisma.teamUpNotification.count.mockResolvedValue(0 as never);
    mockPrisma.tournamentNotification.count.mockResolvedValue(1 as never);
  });

  it('dispatches without throwing when provider is unconfigured', async () => {
    await expect(
      dispatchPushNotifications({
        userIds: ['u1'],
        notificationKind: 'event',
        notificationType: 'join',
        entityId: 'e1',
        params: { eventTitle: 'Friday Match', name: 'Alex' },
      })
    ).resolves.toBeUndefined();
  });

  it('can mark invalid tokens when provider returns failures', async () => {
    process.env.FCM_PROJECT_ID = 'demo-project';
    process.env.FCM_SERVICE_ACCOUNT_JSON = '{"demo":"json"}';

    await dispatchPushNotifications({
      userIds: ['u1'],
      notificationKind: 'group',
      notificationType: 'join_request',
      entityId: 'g1',
    });

    expect(disableInvalidPushTokens).toHaveBeenCalledWith(['short']);
  });
});
