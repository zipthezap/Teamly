import { describe, expect, it, vi } from 'vitest';
import { Permission } from '../../../shared/types/permissions.types';

const mocks = vi.hoisted(() => {
  const pass = (_req: any, _res: any, next: any) => next();
  return {
    requireTournamentPermission: vi.fn(() => pass),
    requireTeamPermission: vi.fn(() => pass),
    authenticatedLimiter: vi.fn(pass),
  };
});

vi.mock('../../middleware/auth', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: mocks.authenticatedLimiter,
}));

vi.mock('../../middleware/authorization', () => ({
  requireTournamentPermission: mocks.requireTournamentPermission,
  requireTeamPermission: mocks.requireTeamPermission,
}));

vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/etag', () => ({
  etagMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/asyncHandler', () => ({
  asyncHandler: (handler: any) => handler,
}));

vi.mock('../../controllers/tournamentController', () => new Proxy({}, {
  get: () => (_req: any, _res: any) => undefined,
}));

// Import after mocks so route registration uses spy factories.
import tournamentRoutes from '../../routes/tournamentRoutes';

describe('Tournament route security wiring', () => {
  it('wires high-risk tournament actions with explicit tournament permissions', () => {
    expect(mocks.requireTournamentPermission).toHaveBeenCalledWith(Permission.TOURNAMENT_MANAGE_TEAMS);
    expect(mocks.requireTournamentPermission).toHaveBeenCalledWith(Permission.TOURNAMENT_MANAGE_BRACKETS);
    expect(mocks.requireTournamentPermission).toHaveBeenCalledWith(Permission.TOURNAMENT_MANAGE_MATCHES);
    expect(mocks.requireTournamentPermission).toHaveBeenCalledWith(Permission.TOURNAMENT_SUBMIT_SCORES);
  });

  it('mounts authenticated limiter on the router', () => {
    const stack = (tournamentRoutes as any).stack as Array<{ handle: unknown }>;
    expect(stack.some((layer) => layer.handle === mocks.authenticatedLimiter)).toBe(true);
  });
});
