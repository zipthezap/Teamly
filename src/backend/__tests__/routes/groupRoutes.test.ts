import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import groupRoutes from '../../routes/groupRoutes';

vi.mock('../../middleware/auth', () => ({
  default: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id', email: 'test@example.com', name: 'Test User' }; next(); },
  optionalAuthMiddleware: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id' }; next(); }
}));
vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: (_: any, __: any, next: any) => next(),
  apiLimiter: (_: any, __: any, next: any) => next(),
  authLimiter: (_: any, __: any, next: any) => next()
}));
vi.mock('../../middleware/distributedRateLimiter', () => ({
  distributedAuthLimiter: (_: any, __: any, next: any) => next(),
  distributedAuthenticatedLimiter: (_: any, __: any, next: any) => next(),
  distributedUploadLimiter: (_: any, __: any, next: any) => next(),
  distributedApiLimiter: (_: any, __: any, next: any) => next(),
  distributedPasswordResetLimiter: (_: any, __: any, next: any) => next(),
  distributedEmailVerificationLimiter: (_: any, __: any, next: any) => next()
}));
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../middleware/etag', () => ({
  etagMiddleware: () => (_: any, __: any, next: any) => next()
}));
vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_: any, __: any, next: any) => next(),
  cacheControl: () => (_: any, __: any, next: any) => next()
}));

vi.mock('../../middleware/upload', () => ({
  uploadGroupPicture: (_: any, __: any, next: any) => next()
}));

vi.mock('../../controllers/groupController', () => ({
  createGroup: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getGroups: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getGroup: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateGroup: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteGroup: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getGroupMembers: vi.fn((req: any, res: any) => res.json({ ok: true })),
  inviteMember: vi.fn((req: any, res: any) => res.json({ ok: true })),
  bulkInviteMembers: vi.fn((req: any, res: any) => res.json({ ok: true })),
  revokeInvitation: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getInviteAnalytics: vi.fn((req: any, res: any) => res.json({ ok: true })),
  generateInviteToken: vi.fn((req: any, res: any) => res.json({ ok: true })),
  removeMember: vi.fn((req: any, res: any) => res.json({ ok: true })),
  removeMemberByUserId: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateMemberRole: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getPublicGroups: vi.fn((req: any, res: any) => res.json({ ok: true })),
  requestJoinGroup: vi.fn((req: any, res: any) => res.json({ ok: true })),
  cancelMyJoinRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getJoinRequests: vi.fn((req: any, res: any) => res.json({ ok: true })),
  handleJoinRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  respondToInvitation: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getUserInvitations: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getMyJoinRequests: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getGroupForInvite: vi.fn((req: any, res: any) => res.json({ ok: true })),
  joinGroupByInvite: vi.fn((req: any, res: any) => res.json({ ok: true })),
  leaveGroup: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getInviteLink: vi.fn((req: any, res: any) => res.json({ ok: true })),
  uploadGroupPicture: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteGroupPicture: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getNearbyGroups: vi.fn((req: any, res: any) => res.json({ ok: true })),
  transferAdmin: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getGroupByInviteToken: vi.fn((req: any, res: any) => res.json({ ok: true })),
  generateGroupInviteToken: vi.fn((req: any, res: any) => res.json({ ok: true })),
  joinGroupByInviteToken: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

describe('Group Routes', () => {
  const app = createTestApp(groupRoutes, '/api');

  it('GET /api/public → 200 (no auth needed)', async () => {
    const res = await request(app).get('/api/public');
    expect(res.status).toBe(200);
  });

  it('GET /api/join/:token → 200 (no auth needed)', async () => {
    const res = await request(app).get('/api/join/some-token');
    expect(res.status).toBe(200);
  });

  it('GET /api/ → 200 when authenticated', async () => {
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
  });

  it('POST /api/ → 200 when authenticated', async () => {
    const res = await request(app).post('/api/').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/:id → 200', async () => {
    const res = await request(app).get('/api/group-1');
    expect(res.status).toBe(200);
  });

  it('PUT /api/:id → 200', async () => {
    const res = await request(app).put('/api/group-1').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id → 200', async () => {
    const res = await request(app).delete('/api/group-1');
    expect(res.status).toBe(200);
  });

  it('POST /api/:id/invite → 200', async () => {
    const res = await request(app).post('/api/group-1/invite').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id/leave → 200', async () => {
    const res = await request(app).delete('/api/group-1/leave');
    expect(res.status).toBe(200);
  });
});
