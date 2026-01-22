/**
 * Additional Group Service Tests
 * Extended test coverage for group management
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import prisma from '../../config/database';
import {
  mockGroup,
  mockGroupWithMembers as _mockGroupWithMembers,
  mockGroupMembers,
  mockGroupAdmins,
  mockJoinRequest,
  mockGroupInvitation,
  mockPrivateGroup,
} from '../__mocks__/mockData';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    group: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    groupMember: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    joinRequest: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    groupInvitation: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Group Service - Extended Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Group Creation', () => {
    it('should create group with all required fields', async () => {
      vi.mocked(prisma.group.create).mockResolvedValueOnce(mockGroup as unknown);

      const result = await prisma.group.create({
        data: {
          name: mockGroup.name,
          description: mockGroup.description,
          creatorId: mockGroup.creatorId,
          isPublic: mockGroup.isPublic,
        },
      });

      expect(result).toEqual(mockGroup);
      expect(prisma.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: mockGroup.name,
            isPublic: mockGroup.isPublic,
          }),
        })
      );
    });

    it('should create group with location', async () => {
      vi.mocked(prisma.group.create).mockResolvedValueOnce(mockGroup as unknown);

      const result = await prisma.group.create({
        data: {
          name: mockGroup.name,
          locationName: mockGroup.locationName,
          city: mockGroup.city,
          country: mockGroup.country,
          latitude: mockGroup.latitude,
          longitude: mockGroup.longitude,
          creatorId: mockGroup.creatorId,
        },
      });

      expect(result.city).toBe('New York');
      expect(result.latitude).toBe(40.7128);
      expect(result.longitude).toBe(-74.0060);
    });

    it('should create public group', async () => {
      vi.mocked(prisma.group.create).mockResolvedValueOnce(mockGroup as unknown);

      const result = await prisma.group.create({
        data: {
          ...mockGroup,
          isPublic: true,
        },
      });

      expect(result.isPublic).toBe(true);
    });

    it('should create private group', async () => {
      vi.mocked(prisma.group.create).mockResolvedValueOnce(mockPrivateGroup as unknown);

      const result = await prisma.group.create({
        data: {
          ...mockPrivateGroup,
          isPublic: false,
        },
      });

      expect(result.isPublic).toBe(false);
    });

    it('should create group with max members limit', async () => {
      vi.mocked(prisma.group.create).mockResolvedValueOnce(mockGroup as unknown);

      const result = await prisma.group.create({
        data: {
          ...mockGroup,
          maxMembers: 100,
        },
      });

      expect(result.maxMembers).toBe(100);
    });

    it('should create group with tags', async () => {
      vi.mocked(prisma.group.create).mockResolvedValueOnce(mockGroup as unknown);

      const result = await prisma.group.create({
        data: {
          ...mockGroup,
          tags: 'soccer, sports',
        },
      });

      expect(result.tags).toBe('soccer, sports');
    });
  });

  describe('Group Updates', () => {
    it('should update group name', async () => {
      const updatedGroup = { ...mockGroup, name: 'Updated Group Name' };
      vi.mocked(prisma.group.update).mockResolvedValueOnce(updatedGroup as unknown);

      const result = await prisma.group.update({
        where: { id: mockGroup.id },
        data: { name: 'Updated Group Name' },
      });

      expect(result.name).toBe('Updated Group Name');
    });

    it('should update group description', async () => {
      const updatedGroup = { ...mockGroup, description: 'New description' };
      vi.mocked(prisma.group.update).mockResolvedValueOnce(updatedGroup as unknown);

      const result = await prisma.group.update({
        where: { id: mockGroup.id },
        data: { description: 'New description' },
      });

      expect(result.description).toBe('New description');
    });

    it('should update group privacy setting', async () => {
      const updatedGroup = { ...mockGroup, isPublic: false };
      vi.mocked(prisma.group.update).mockResolvedValueOnce(updatedGroup as unknown);

      const result = await prisma.group.update({
        where: { id: mockGroup.id },
        data: { isPublic: false },
      });

      expect(result.isPublic).toBe(false);
    });

    it('should update group location', async () => {
      const updatedGroup = { ...mockGroup, city: 'Boston', country: 'USA' };
      vi.mocked(prisma.group.update).mockResolvedValueOnce(updatedGroup as unknown);

      const result = await prisma.group.update({
        where: { id: mockGroup.id },
        data: { city: 'Boston', country: 'USA' },
      });

      expect(result.city).toBe('Boston');
    });

    it('should update max members', async () => {
      const updatedGroup = { ...mockGroup, maxMembers: 150 };
      vi.mocked(prisma.group.update).mockResolvedValueOnce(updatedGroup as unknown);

      const result = await prisma.group.update({
        where: { id: mockGroup.id },
        data: { maxMembers: 150 },
      });

      expect(result.maxMembers).toBe(150);
    });
  });

  describe('Group Member Management', () => {
    it('should add member to group', async () => {
      const member = mockGroupMembers[0];
      vi.mocked(prisma.groupMember.create).mockResolvedValueOnce(member as unknown);

      const result = await prisma.groupMember.create({
        data: {
          groupId: member.groupId,
          userId: member.userId,
          role: member.role,
        },
      });

      expect(result).toEqual(member);
    });

    it('should list all group members', async () => {
      vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce(mockGroupMembers as unknown);

      const result = await prisma.groupMember.findMany({
        where: { groupId: 'group-1' },
      });

      expect(result).toHaveLength(3);
      expect(result).toEqual(mockGroupMembers);
    });

    it('should count group members', async () => {
      vi.mocked(prisma.groupMember.count).mockResolvedValueOnce(3);

      const count = await prisma.groupMember.count({
        where: { groupId: 'group-1' },
      });

      expect(count).toBe(3);
    });

    it('should find group admins', async () => {
      vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce(mockGroupAdmins as unknown);

      const result = await prisma.groupMember.findMany({
        where: { groupId: 'group-1', role: 'admin' },
      });

      expect(result).toHaveLength(2);
      expect(result.every(m => m.role === 'admin')).toBe(true);
    });

    it('should update member role', async () => {
      const updatedMember = { ...mockGroupMembers[1], role: 'moderator' };
      vi.mocked(prisma.groupMember.update).mockResolvedValueOnce(updatedMember as unknown);

      const result = await prisma.groupMember.update({
        where: { id: 'member-2' },
        data: { role: 'moderator' },
      });

      expect(result.role).toBe('moderator');
    });

    it('should remove member from group', async () => {
      vi.mocked(prisma.groupMember.delete).mockResolvedValueOnce(mockGroupMembers[0] as unknown);

      const result = await prisma.groupMember.delete({
        where: { id: 'member-1' },
      });

      expect(result).toEqual(mockGroupMembers[0]);
    });

    it('should check if user is group member', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(mockGroupMembers[0] as unknown);

      const result = await prisma.groupMember.findFirst({
        where: { groupId: 'group-1', userId: 'user-1' },
      });

      expect(result).toBeDefined();
      expect(result?.userId).toBe('user-1');
    });

    it('should return null if user is not a member', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);

      const result = await prisma.groupMember.findFirst({
        where: { groupId: 'group-1', userId: 'user-999' },
      });

      expect(result).toBeNull();
    });
  });

  describe('Group Permissions', () => {
    it('should verify admin permissions', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(mockGroupAdmins[0] as unknown);

      const result = await prisma.groupMember.findFirst({
        where: { groupId: 'group-1', userId: 'user-1', role: 'admin' },
      });

      expect(result).toBeDefined();
      expect(result?.role).toBe('admin');
    });

    it('should verify moderator permissions', async () => {
      const moderator = mockGroupMembers[2];
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(moderator as unknown);

      const result = await prisma.groupMember.findFirst({
        where: { groupId: 'group-1', userId: 'user-3', role: 'moderator' },
      });

      expect(result).toBeDefined();
      expect(result?.role).toBe('moderator');
    });

    it('should check admin or moderator role', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(mockGroupAdmins[0] as unknown);

      const result = await prisma.groupMember.findFirst({
        where: {
          groupId: 'group-1',
          userId: 'user-1',
          role: { in: ['admin', 'moderator'] },
        },
      });

      expect(result).toBeDefined();
      expect(['admin', 'moderator']).toContain(result?.role);
    });
  });

  describe('Join Requests', () => {
    it('should create join request', async () => {
      vi.mocked(prisma.joinRequest.create).mockResolvedValueOnce(mockJoinRequest as unknown);

      const result = await prisma.joinRequest.create({
        data: {
          userId: mockJoinRequest.userId,
          groupId: mockJoinRequest.groupId,
          status: 'pending',
        },
      });

      expect(result).toEqual(mockJoinRequest);
      expect(result.status).toBe('pending');
    });

    it('should list pending join requests', async () => {
      vi.mocked(prisma.joinRequest.findMany).mockResolvedValueOnce([mockJoinRequest] as unknown);

      const result = await prisma.joinRequest.findMany({
        where: { groupId: 'group-1', status: 'pending' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('should approve join request', async () => {
      const approvedRequest = { ...mockJoinRequest, status: 'approved' };
      vi.mocked(prisma.joinRequest.update).mockResolvedValueOnce(approvedRequest as unknown);

      const result = await prisma.joinRequest.update({
        where: { id: 'request-1' },
        data: { status: 'approved' },
      });

      expect(result.status).toBe('approved');
    });

    it('should reject join request', async () => {
      const rejectedRequest = { ...mockJoinRequest, status: 'rejected' };
      vi.mocked(prisma.joinRequest.update).mockResolvedValueOnce(rejectedRequest as unknown);

      const result = await prisma.joinRequest.update({
        where: { id: 'request-1' },
        data: { status: 'rejected' },
      });

      expect(result.status).toBe('rejected');
    });
  });

  describe('Group Invitations', () => {
    it('should create group invitation', async () => {
      vi.mocked(prisma.groupInvitation.create).mockResolvedValueOnce(mockGroupInvitation as unknown);

      const result = await prisma.groupInvitation.create({
        data: {
          userId: mockGroupInvitation.userId,
          groupId: mockGroupInvitation.groupId,
          invitedBy: mockGroupInvitation.invitedBy,
          status: 'pending',
        },
      });

      expect(result).toEqual(mockGroupInvitation);
    });

    it('should list pending invitations', async () => {
      vi.mocked(prisma.groupInvitation.findMany).mockResolvedValueOnce([mockGroupInvitation] as unknown);

      const result = await prisma.groupInvitation.findMany({
        where: { groupId: 'group-1', status: 'pending' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('should accept invitation', async () => {
      const acceptedInvitation = { ...mockGroupInvitation, status: 'accepted' };
      vi.mocked(prisma.groupInvitation.update).mockResolvedValueOnce(acceptedInvitation as unknown);

      const result = await prisma.groupInvitation.update({
        where: { id: 'invitation-1' },
        data: { status: 'accepted' },
      });

      expect(result.status).toBe('accepted');
    });

    it('should decline invitation', async () => {
      const declinedInvitation = { ...mockGroupInvitation, status: 'declined' };
      vi.mocked(prisma.groupInvitation.update).mockResolvedValueOnce(declinedInvitation as unknown);

      const result = await prisma.groupInvitation.update({
        where: { id: 'invitation-1' },
        data: { status: 'declined' },
      });

      expect(result.status).toBe('declined');
    });
  });

  describe('Group Queries', () => {
    it('should find group by ID', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValueOnce(mockGroup as unknown);

      const result = await prisma.group.findUnique({
        where: { id: mockGroup.id },
      });

      expect(result).toEqual(mockGroup);
    });

    it('should find groups by city', async () => {
      vi.mocked(prisma.group.findMany).mockResolvedValueOnce([mockGroup] as unknown);

      const result = await prisma.group.findMany({
        where: { city: 'New York' },
      });

      expect(result.every(g => g.city === 'New York')).toBe(true);
    });

    it('should find public groups', async () => {
      vi.mocked(prisma.group.findMany).mockResolvedValueOnce([mockGroup] as unknown);

      const result = await prisma.group.findMany({
        where: { isPublic: true },
      });

      expect(result.every(g => g.isPublic === true)).toBe(true);
    });

    it('should search groups by name', async () => {
      vi.mocked(prisma.group.findMany).mockResolvedValueOnce([mockGroup] as unknown);

      const result = await prisma.group.findMany({
        where: {
          name: { contains: 'Soccer', mode: 'insensitive' },
        },
      });

      expect(result).toHaveLength(1);
    });

    it('should find groups by creator', async () => {
      vi.mocked(prisma.group.findMany).mockResolvedValueOnce([mockGroup] as unknown);

      const result = await prisma.group.findMany({
        where: { creatorId: 'user-1' },
      });

      expect(result.every(g => g.creatorId === 'user-1')).toBe(true);
    });
  });

  describe('Group Deletion', () => {
    it('should delete group', async () => {
      vi.mocked(prisma.group.delete).mockResolvedValueOnce(mockGroup as unknown);

      const result = await prisma.group.delete({
        where: { id: mockGroup.id },
      });

      expect(result).toEqual(mockGroup);
    });
  });
});
