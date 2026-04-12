import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { BadRequestError, ForbiddenError } from '../../utils/errors';

vi.mock('../../services/groupService', () => ({
  checkGroupAdmin: vi.fn(),
  isGroupMember: vi.fn(),
  getGroupMember: vi.fn(),
}));

vi.mock('../../services/permissionService', () => ({
  hasPermission: vi.fn(),
}));

import {
  requireGroupAdmin,
  requireGroupMembership,
  requirePermission,
  requireTournamentPermission,
  requireTeamPermission,
  requireTeamUpPermission,
} from '../../middleware/authorization';
import * as groupService from '../../services/groupService';
import * as permissionService from '../../services/permissionService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { id: 'user-1', email: 'u@example.com', name: 'User' } as any,
    params: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

const res = {} as Response;
const makeNext = () => vi.fn() as unknown as NextFunction;

// ─── requireGroupAdmin ────────────────────────────────────────────────────────

describe('requireGroupAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls next() when user is a group admin', async () => {
    vi.mocked(groupService.checkGroupAdmin).mockResolvedValue(true);
    const req = makeReq({ params: { id: 'group-1' } });
    const next = makeNext();

    await requireGroupAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith(); // no args = success
  });

  it('calls next(ForbiddenError) when user is not an admin', async () => {
    vi.mocked(groupService.checkGroupAdmin).mockResolvedValue(false);
    const req = makeReq({ params: { id: 'group-1' } });
    const next = makeNext();

    await requireGroupAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('calls next(ForbiddenError) when req.user is missing', async () => {
    const req = makeReq({ user: undefined, params: { id: 'group-1' } });
    const next = makeNext();

    await requireGroupAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('calls next(BadRequestError) when no groupId is provided', async () => {
    const req = makeReq({ params: {}, body: {} });
    const next = makeNext();

    await requireGroupAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
  });

  it('falls back to body.groupId when params.id is absent', async () => {
    vi.mocked(groupService.checkGroupAdmin).mockResolvedValue(true);
    const req = makeReq({ params: {}, body: { groupId: 'group-from-body' } });
    const next = makeNext();

    await requireGroupAdmin(req, res, next);

    expect(groupService.checkGroupAdmin).toHaveBeenCalledWith('group-from-body', 'user-1');
    expect(next).toHaveBeenCalledWith();
  });
});

// ─── requireGroupMembership ───────────────────────────────────────────────────

describe('requireGroupMembership', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls next() when user is a group member', async () => {
    vi.mocked(groupService.isGroupMember).mockResolvedValue(true);
    const req = makeReq({ params: { id: 'group-1' } });
    const next = makeNext();

    await requireGroupMembership(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ForbiddenError) when user is not a member', async () => {
    vi.mocked(groupService.isGroupMember).mockResolvedValue(false);
    const req = makeReq({ params: { id: 'group-1' } });
    const next = makeNext();

    await requireGroupMembership(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('calls next(ForbiddenError) when req.user is missing', async () => {
    const req = makeReq({ user: undefined, params: { id: 'group-1' } });
    const next = makeNext();

    await requireGroupMembership(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

// ─── requirePermission factory ────────────────────────────────────────────────

describe('requirePermission', () => {
  const permission = 'manage_sessions' as any;

  beforeEach(() => vi.clearAllMocks());

  it('calls next() when hasPermission returns true', async () => {
    vi.mocked(permissionService.hasPermission).mockResolvedValue(true);
    const middleware = requirePermission(permission, 'group', (req) => req.params.id);
    const req = makeReq({ params: { id: 'group-1' } });
    const next = makeNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ForbiddenError) when hasPermission returns false', async () => {
    vi.mocked(permissionService.hasPermission).mockResolvedValue(false);
    const middleware = requirePermission(permission, 'group', (req) => req.params.id);
    const req = makeReq({ params: { id: 'group-1' } });
    const next = makeNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('calls next(BadRequestError) when resourceId is empty', async () => {
    const middleware = requirePermission(permission, 'group', () => '');
    const req = makeReq({ params: {} });
    const next = makeNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    expect(permissionService.hasPermission).not.toHaveBeenCalled();
  });

  it('calls next(ForbiddenError) when user is not authenticated', async () => {
    const middleware = requirePermission(permission, 'group', (req) => req.params.id);
    const req = makeReq({ user: undefined, params: { id: 'group-1' } });
    const next = makeNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

// ─── Wiring tests ─────────────────────────────────────────────────────────────

describe('requireTournamentPermission wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes resourceType=tournament and uses req.params.id', async () => {
    vi.mocked(permissionService.hasPermission).mockResolvedValue(true);
    const middleware = requireTournamentPermission('manage_sessions' as any);
    const req = makeReq({ params: { id: 'tournament-1' } });
    const next = makeNext();

    await middleware(req, res, next);

    expect(permissionService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'tournament', resourceId: 'tournament-1' })
    );
  });
});

describe('requireTeamPermission wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes resourceType=team and uses req.params.teamId', async () => {
    vi.mocked(permissionService.hasPermission).mockResolvedValue(true);
    const middleware = requireTeamPermission('manage_sessions' as any);
    const req = makeReq({ params: { teamId: 'team-1' } });
    const next = makeNext();

    await middleware(req, res, next);

    expect(permissionService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'team', resourceId: 'team-1' })
    );
  });
});

describe('requireTeamUpPermission wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes resourceType=teamup and uses req.params.id', async () => {
    vi.mocked(permissionService.hasPermission).mockResolvedValue(true);
    const middleware = requireTeamUpPermission('manage_sessions' as any);
    const req = makeReq({ params: { id: 'teamup-1' } });
    const next = makeNext();

    await middleware(req, res, next);

    expect(permissionService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'teamup', resourceId: 'teamup-1' })
    );
  });
});
