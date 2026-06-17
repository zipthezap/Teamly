import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as controller from '../../controllers/authOAuthController';
import { CacheService } from '../../services/cacheService';
import prisma from '../../config/database';

vi.mock('../../services/cacheService', () => ({
  CacheService: {
    set: vi.fn(),
    get: vi.fn(),
    deletePattern: vi.fn()
  }
}));

vi.mock('../../config/database', () => ({
  default: {
    user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() }
  }
}));

describe('Auth OAuth linking flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates a link token', async () => {
    const req: any = { body: { provider: 'google', providerId: 'p1', email: 'test@example.com' } };
    const res: any = { json: vi.fn() };

    await controller.startOAuthLink(req, res);

    expect(CacheService.set).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: expect.any(String) }));
  });

  it('confirms link when authenticated user matches email', async () => {
    const token = 'tok123';
    const key = `oauth_link:${token}`;
    const payload = { provider: 'google', providerId: 'p1', email: 'me@example.com' };

    vi.mocked(CacheService.get).mockResolvedValue(JSON.stringify(payload));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', email: 'me@example.com' } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const req: any = { user: { id: 'u1' }, body: { token } };
    const res: any = { json: vi.fn() };

    await controller.confirmOAuthLink(req, res);

    expect(prisma.user.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'OAuth provider linked successfully' });
  });
});
