import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createAuthenticatedTestApp } from '../helpers/testApp';

vi.mock('../../middleware/auth', () => ({
  default: (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_req: any, _res: any, next: any) => next(),
  cacheControl: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/etag', () => ({
  etagMiddleware: () => (_req: any, _res: any, next: any) => next(),
  generateWeakETag: vi.fn(),
  generateStrongETag: vi.fn(),
  generateETag: vi.fn(),
}));

vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/distributedRateLimiter', () => ({
  distributedAuthenticatedLimiter: (_req: any, _res: any, next: any) => next(),
  distributedUploadLimiter: (_req: any, _res: any, next: any) => next(),
  distributedApiLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/upload', () => ({
  upload: { single: vi.fn(() => (_r: any, _rs: any, n: any) => n()) },
  uploadGroupPicture: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../config/database', () => ({
  default: {
    group: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    groupMember: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
    groupInvitation: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    groupJoinRequest: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    groupNotification: { create: vi.fn(), createMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    groupBan: { findUnique: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/groupService', () => ({
  sanitizeGroupData: vi.fn((d: any) => d),
  validateMaxMembers: vi.fn(() => ({ valid: true })),
  validateCoordinateCompleteness: vi.fn(() => ({ valid: true })),
  validateGroupCoordinates: vi.fn(async () => ({ valid: true })),
  isValidRole: vi.fn(() => true),
  checkGroupCapacityAndMembership: vi.fn(),
  getGroupStats: vi.fn(),
  getGroupSessionStats: vi.fn(),
  computeNextSession: vi.fn(),
  buildGroupFilters: vi.fn(() => ({})),
  canManageGroup: vi.fn(),
  getGroupActivity: vi.fn(),
}));

vi.mock('../../services/permissionService', () => ({
  checkPermission: vi.fn(),
  getUserPermissions: vi.fn(),
  hasPermission: vi.fn(),
  hasGroupPermission: vi.fn(),
  clearUserPermissionCache: vi.fn(),
}));

vi.mock('../../services/locationService', () => ({
  getNearbyGroups: vi.fn(),
  calculateDistance: vi.fn(),
  enrichWithLocationInfo: vi.fn((g: any) => g),
  validateCoordinates: vi.fn(() => ({ valid: true })),
  filterByLocation: vi.fn(() => []),
  calculateBoundingBox: vi.fn(() => ({ latDelta: 1, lonDelta: 1 })),
}));

vi.mock('../../utils/imageProcessor', () => ({
  validateImage: vi.fn(),
  processImage: vi.fn(),
  deleteFile: vi.fn(),
  deleteOldPicture: vi.fn(),
  generateUniqueFilename: vi.fn().mockReturnValue('group_123.jpg'),
}));

vi.mock('../../utils/inviteToken', () => ({
  createInviteToken: vi.fn().mockReturnValue('mock-invite-token'),
}));

vi.mock('../../services/notificationFactory', () => ({
  NotificationFactory: {
    createGroupNotifications: vi.fn(),
    createSessionNotifications: vi.fn(),
  },
}));

vi.mock('../../services/metricsService', () => ({
  recordSearchQuery: vi.fn(),
}));

vi.mock('../../services/inviteService', () => ({
  InviteService: {
    createInvitation: vi.fn(),
    getInvitationAnalytics: vi.fn(),
    bulkInvite: vi.fn(),
    revokeInvitation: vi.fn(),
    canUserInvite: vi.fn(),
    inviteUserToGroup: vi.fn(),
    batchInviteToGroup: vi.fn(),
    generateInviteToken: vi.fn(),
    validateInviteToken: vi.fn(),
    getInviteAnalytics: vi.fn(),
  },
}));

vi.mock('../../services/cacheService', () => ({
  CacheService: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    invalidatePattern: vi.fn(),
    deletePattern: vi.fn(),
  },
}));

vi.mock('../../utils/prismaExtended', () => ({
  groupBan: vi.fn((client: any) => client.groupBan),
  txGroupBan: vi.fn((client: any) => client.groupBan),
  auditLog: vi.fn((client: any) => client.auditLog),
  txAuditLog: vi.fn((client: any) => client.auditLog),
}));

vi.mock('../../utils/notificationHelper', () => ({
  filterUnmutedUsers: vi.fn().mockResolvedValue([]),
}));

import prisma from '../../config/database';
import groupRoutes from '../../routes/groupRoutes';
import { CacheService } from '../../services/cacheService';
import * as permissionService from '../../services/permissionService';
import * as groupService from '../../services/groupService';
import { InviteService } from '../../services/inviteService';

const app = createAuthenticatedTestApp(groupRoutes, 'test-user-id', '/api/groups');

const mockGroup = {
  id: 'group-1',
  name: 'Test Group',
  description: 'A test group',
  isPublic: true,
  sportType: 'soccer',
  maxMembers: null,
  autoApproveJoinRequests: false,
  inviteToken: 'existing-invite-token',
  allowMemberCopyLink: true,
  allowMemberInvites: false,
  latitude: null,
  longitude: null,
  locationName: null,
  city: null,
  country: null,
  tags: null,
  picture: null,
  creatorId: 'test-user-id',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  creator: { id: 'test-user-id', name: 'Test User', email: 'test@example.com', profilePicture: null },
  members: [
    {
      id: 'gm-1',
      userId: 'test-user-id',
      groupId: 'group-1',
      role: 'admin',
      user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com', profilePicture: null },
    },
  ],
  _count: { sessions: 0, members: 1 },
};

const mockMembership = {
  id: 'gm-1',
  userId: 'test-user-id',
  groupId: 'group-1',
  role: 'admin',
};

describe('Group Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CacheService.get).mockResolvedValue(null);
    vi.mocked(CacheService.set).mockResolvedValue(undefined as any);
    vi.mocked(CacheService.invalidate).mockResolvedValue(undefined as any);
    vi.mocked(CacheService.deletePattern).mockResolvedValue(undefined as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fnOrArray: any) => {
      if (typeof fnOrArray === 'function') return fnOrArray(prisma);
      return Promise.all(fnOrArray);
    });
    vi.mocked(prisma.groupNotification.create).mockResolvedValue({} as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
  });

  // ─── POST /api/groups ──────────────────────────────────────────────────────

  describe('POST /api/groups', () => {
    it('returns 201 with created group', async () => {
      vi.mocked(groupService.sanitizeGroupData).mockReturnValue({ name: 'Test Group' } as any);
      vi.mocked(prisma.group.create).mockResolvedValue({ ...mockGroup, isPublic: false } as any);

      const res = await request(app).post('/api/groups').send({ name: 'Test Group' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Test Group' });
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app).post('/api/groups').send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when maxMembers is invalid', async () => {
      vi.mocked(groupService.validateMaxMembers).mockReturnValue({ valid: false, error: 'Invalid max members' });

      const res = await request(app).post('/api/groups').send({ name: 'Test Group', maxMembers: -1 });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/groups ───────────────────────────────────────────────────────

  describe('GET /api/groups', () => {
    it('returns 200 with user groups', async () => {
      vi.mocked(prisma.group.findMany).mockResolvedValue([mockGroup] as any);

      const res = await request(app).get('/api/groups');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── GET /api/groups/:id ───────────────────────────────────────────────────

  describe('GET /api/groups/:id', () => {
    it('returns 200 when user is a member', async () => {
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValue(mockMembership as any);
      vi.mocked(prisma.group.findFirst).mockResolvedValue(mockGroup as any);

      const res = await request(app).get('/api/groups/group-1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 'group-1' });
    });

    it('returns 404 when group not found (non-member)', async () => {
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.group.findFirst).mockResolvedValue(null);

      const res = await request(app).get('/api/groups/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/groups/:id ───────────────────────────────────────────────────

  describe('PUT /api/groups/:id', () => {
    it('returns 200 with updated group', async () => {
      vi.mocked(permissionService.hasGroupPermission).mockResolvedValue(true);
      vi.mocked(groupService.validateMaxMembers).mockReturnValue({ valid: true });
      vi.mocked(groupService.sanitizeGroupData).mockReturnValue({ name: 'Updated Group' } as any);
      vi.mocked(groupService.validateCoordinateCompleteness).mockReturnValue({ valid: true });
      vi.mocked(groupService.validateGroupCoordinates).mockResolvedValue({ valid: true } as any);
      vi.mocked(prisma.group.update).mockResolvedValue({ ...mockGroup, name: 'Updated Group' } as any);

      const res = await request(app).put('/api/groups/group-1').send({ name: 'Updated Group' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'Updated Group' });
    });

    it('returns 403 when user lacks permission', async () => {
      vi.mocked(permissionService.hasGroupPermission).mockResolvedValue(false);

      const res = await request(app).put('/api/groups/group-1').send({ name: 'Updated Group' });

      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /api/groups/:id ────────────────────────────────────────────────

  describe('DELETE /api/groups/:id', () => {
    it('returns 200 when group deleted successfully', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue(mockGroup as any);
      vi.mocked(permissionService.hasGroupPermission).mockResolvedValue(true);
      vi.mocked(prisma.group.delete).mockResolvedValue(mockGroup as any);

      const res = await request(app).delete('/api/groups/group-1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Group deleted successfully' });
    });

    it('returns 404 when group not found', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue(null);

      const res = await request(app).delete('/api/groups/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/groups/:id/members ──────────────────────────────────────────

  describe('GET /api/groups/:id/members', () => {
    it('returns 200 with member list', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue(mockGroup as any);

      const res = await request(app).get('/api/groups/group-1/members');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 404 when group not found', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue(null);

      const res = await request(app).get('/api/groups/nonexistent/members');

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/groups/:id/members/:memberId ──────────────────────────────

  describe('DELETE /api/groups/:id/members/:memberId', () => {
    it('returns 200 when member removed', async () => {
      vi.mocked(permissionService.hasGroupPermission).mockResolvedValue(true);
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValue({
        id: 'gm-2',
        userId: 'other-user-id',
        groupId: 'group-1',
        role: 'member',
        user: { id: 'other-user-id', name: 'Other User', email: 'other@example.com' },
      } as any);
      vi.mocked(prisma.group.findUnique).mockResolvedValue({ id: 'group-1', name: 'Test Group' } as any);
      vi.mocked(prisma.groupMember.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.groupJoinRequest.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.groupBan.upsert).mockResolvedValue({} as any);

      const res = await request(app).delete('/api/groups/group-1/members/gm-2');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Member removed successfully' });
    });
  });

  // ─── PUT /api/groups/:id/members/:memberId/role ────────────────────────────

  describe('PUT /api/groups/:id/members/:memberId/role', () => {
    it('returns 200 with updated member role', async () => {
      const adminMembership = { id: 'gm-1', userId: 'test-user-id', groupId: 'group-1', role: 'admin' };
      const memberToUpdate = { id: 'gm-2', userId: 'other-user-id', groupId: 'group-1', role: 'member' };
      const updatedMember = {
        ...memberToUpdate,
        role: 'admin',
        user: { id: 'other-user-id', name: 'Other User', email: 'other@example.com' },
      };

      vi.mocked(prisma.groupMember.findFirst)
        .mockResolvedValueOnce(adminMembership as any)
        .mockResolvedValueOnce(memberToUpdate as any);
      vi.mocked(prisma.groupMember.update).mockResolvedValue(updatedMember as any);
      vi.mocked(permissionService.clearUserPermissionCache).mockResolvedValue(undefined as any);

      const res = await request(app)
        .put('/api/groups/group-1/members/gm-2/role')
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid role', async () => {
      vi.mocked(groupService.isValidRole).mockReturnValue(false);

      const res = await request(app)
        .put('/api/groups/group-1/members/gm-2/role')
        .send({ role: 'superadmin' });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/groups/:id/invite ──────────────────────────────────────────

  describe('POST /api/groups/:id/invite', () => {
    it('returns 201 when invitation sent', async () => {
      vi.mocked(InviteService.canUserInvite).mockResolvedValue({ allowed: true } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'other-user-id',
        email: 'other@example.com',
        name: 'Other User',
      } as any);
      vi.mocked(InviteService.inviteUserToGroup).mockResolvedValue({ success: true } as any);

      const res = await request(app)
        .post('/api/groups/group-1/invite')
        .send({ email: 'other@example.com' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ message: 'Invitation sent successfully' });
    });

    it('returns 400 when email is missing', async () => {
      const res = await request(app).post('/api/groups/group-1/invite').send({});
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/groups/:id/invitations/revoke ───────────────────────────────

  describe('POST /api/groups/:id/invitations/revoke', () => {
    it('returns 200 when invitation revoked', async () => {
      vi.mocked(permissionService.hasGroupPermission).mockResolvedValue(true);
      vi.mocked(InviteService.revokeInvitation).mockResolvedValue({ success: true } as any);

      const res = await request(app)
        .post('/api/groups/group-1/invitations/revoke')
        .send({ email: 'other@example.com' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Invitation revoked successfully' });
    });

    it('returns 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/groups/group-1/invitations/revoke')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/groups/:id/join-request ────────────────────────────────────

  describe('POST /api/groups/:id/join-request', () => {
    it('returns 201 with join request created', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue({
        ...mockGroup,
        autoApproveJoinRequests: false,
      } as any);
      vi.mocked(prisma.groupBan.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.groupJoinRequest.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.groupJoinRequest.create).mockResolvedValue({
        id: 'jr-1',
        groupId: 'group-1',
        userId: 'test-user-id',
        status: 'pending',
        createdBy: 'USER',
        user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' },
        group: { id: 'group-1', name: 'Test Group', description: 'Desc' },
      } as any);
      vi.mocked(prisma.groupMember.findMany).mockResolvedValue([]);

      const res = await request(app).post('/api/groups/group-1/join-request');

      expect(res.status).toBe(201);
    });

    it('returns 404 when group not found', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue(null);

      const res = await request(app).post('/api/groups/nonexistent/join-request');

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/groups/:id/join-requests/:requestId ────────────────────────

  describe('POST /api/groups/:id/join-requests/:requestId', () => {
    it('returns 200 when join request approved', async () => {
      const joinRequest = {
        id: 'jr-1',
        groupId: 'group-1',
        userId: 'other-user-id',
        status: 'pending',
        createdBy: 'USER',
      };

      vi.mocked(permissionService.hasGroupPermission).mockResolvedValue(true);
      vi.mocked(prisma.groupJoinRequest.findUnique).mockResolvedValue(joinRequest as any);
      vi.mocked(prisma.groupJoinRequest.update).mockResolvedValue({
        ...joinRequest,
        status: 'approved',
      } as any);
      vi.mocked(prisma.group.findUnique).mockResolvedValue({
        id: 'group-1',
        name: 'Test Group',
        maxMembers: null,
      } as any);
      vi.mocked(groupService.checkGroupCapacityAndMembership).mockResolvedValue(undefined as any);
      vi.mocked(prisma.groupMember.create).mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/groups/group-1/join-requests/jr-1')
        .send({ action: 'approve' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Join request approved successfully' });
    });

    it('returns 400 for invalid action', async () => {
      vi.mocked(permissionService.hasGroupPermission).mockResolvedValue(true);

      const res = await request(app)
        .post('/api/groups/group-1/join-requests/jr-1')
        .send({ action: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /api/groups/:id/leave ─────────────────────────────────────────

  describe('DELETE /api/groups/:id/leave', () => {
    it('returns 200 when left group successfully', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({
        id: 'gm-1',
        userId: 'test-user-id',
        groupId: 'group-1',
        role: 'member',
      } as any);
      vi.mocked(prisma.groupMember.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.groupJoinRequest.deleteMany).mockResolvedValue({ count: 0 } as any);

      const res = await request(app).delete('/api/groups/group-1/leave');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Left group successfully' });
    });
  });

  // ─── GET /api/groups/public ───────────────────────────────────────────────

  describe('GET /api/groups/public', () => {
    it('returns 200 with public groups list', async () => {
      vi.mocked(prisma.group.findMany).mockResolvedValue([mockGroup] as any);

      const res = await request(app).get('/api/groups/public');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ groups: expect.any(Array) });
    });
  });

  // ─── GET /api/groups/:id/invite-link ──────────────────────────────────────

  describe('GET /api/groups/:id/invite-link', () => {
    it('returns 200 with invite link for admin', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue(mockGroup as any);
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue(mockMembership as any);

      const res = await request(app).get('/api/groups/group-1/invite-link');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('inviteToken');
      expect(res.body).toHaveProperty('inviteUrl');
    });

    it('returns 404 when group not found', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue(null);

      const res = await request(app).get('/api/groups/nonexistent/invite-link');

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/groups/join/:groupId ───────────────────────────────────────

  describe('POST /api/groups/join/:groupId', () => {
    it('returns 404 when group not found', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue(null);

      const res = await request(app).post('/api/groups/join/nonexistent');

      expect(res.status).toBe(404);
    });

    it('returns 201 when joined public group successfully', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue({
        id: 'group-1',
        name: 'Test Group',
        isPublic: true,
      } as any);
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.groupMember.create).mockResolvedValue({} as any);

      const res = await request(app).post('/api/groups/join/group-1');

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ message: 'Joined group successfully' });
    });
  });
});
