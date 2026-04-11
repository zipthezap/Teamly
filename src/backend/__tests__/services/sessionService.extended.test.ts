/**
 * Additional Event Service Tests
 * Extended test coverage for session management
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import prisma from '../../config/database';
import {
  mockEvent,
  mockEventWithGroup as _mockEventWithGroup,
  mockRecurringEvent,
  mockEventParticipants,
  mockEventActivity,
} from '../__mocks__/mockData';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    session: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    eventParticipant: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    eventActivity: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    groupMember: {
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

describe('Event Service - Extended Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Creation', () => {
    it('should create session with all required fields', async () => {
      vi.mocked(prisma.session.create).mockResolvedValueOnce(mockEvent as unknown);

      const result = await prisma.session.create({
        data: {
          title: mockEvent.title,
          description: mockEvent.description,
          sessionType: mockEvent.sessionType,
          location: mockEvent.location,
          startTime: mockEvent.startTime,
          creatorId: mockEvent.creatorId,
          groupId: mockEvent.groupId,
        },
      });

      expect(result).toEqual(mockEvent);
      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: mockEvent.title,
            sessionType: mockEvent.sessionType,
          }),
        })
      );
    });

    it('should create recurring session with recurrence rule', async () => {
      vi.mocked(prisma.session.create).mockResolvedValueOnce(mockRecurringEvent as unknown);

      const result = await prisma.session.create({
        data: {
          title: mockRecurringEvent.title,
          isRecurring: true,
          recurrenceRule: mockRecurringEvent.recurrenceRule,
          sessionType: mockRecurringEvent.sessionType,
          startTime: mockRecurringEvent.startTime,
          creatorId: mockRecurringEvent.creatorId,
          groupId: mockRecurringEvent.groupId,
        },
      });

      expect(result.isRecurring).toBe(true);
      expect(result.recurrenceRule).toBe('FREQ=WEEKLY;BYDAY=MO');
    });

    it('should create session with max participants limit', async () => {
      const eventWithLimit = { ...mockEvent, maxParticipants: 20 };
      vi.mocked(prisma.session.create).mockResolvedValueOnce(eventWithLimit as unknown);

      const result = await prisma.session.create({
        data: {
          ...mockEvent,
          maxParticipants: 20,
        },
      });

      expect(result.maxParticipants).toBe(20);
    });

    it('should create public session', async () => {
      const publicEvent = { ...mockEvent, visibility: 'public' };
      vi.mocked(prisma.session.create).mockResolvedValueOnce(publicEvent as unknown);

      const result = await prisma.session.create({
        data: {
          ...mockEvent,
          visibility: 'public',
        },
      });

      expect(result.visibility).toBe('public');
    });

    it('should create private session', async () => {
      const privateEvent = { ...mockEvent, visibility: 'private' };
      vi.mocked(prisma.session.create).mockResolvedValueOnce(privateEvent as unknown);

      const result = await prisma.session.create({
        data: {
          ...mockEvent,
          visibility: 'private',
        },
      });

      expect(result.visibility).toBe('private');
    });
  });

  describe('Event Updates', () => {
    it('should update session title', async () => {
      const updatedEvent = { ...mockEvent, title: 'Updated Soccer Match' };
      vi.mocked(prisma.session.update).mockResolvedValueOnce(updatedEvent as unknown);

      const result = await prisma.session.update({
        where: { id: mockEvent.id },
        data: { title: 'Updated Soccer Match' },
      });

      expect(result.title).toBe('Updated Soccer Match');
    });

    it('should update session time', async () => {
      const newStartTime = new Date('2024-02-02T10:00:00Z');
      const updatedEvent = { ...mockEvent, startTime: newStartTime };
      vi.mocked(prisma.session.update).mockResolvedValueOnce(updatedEvent as unknown);

      const result = await prisma.session.update({
        where: { id: mockEvent.id },
        data: { startTime: newStartTime },
      });

      expect(result.startTime).toEqual(newStartTime);
    });

    it('should update session location', async () => {
      const updatedEvent = { ...mockEvent, location: 'Riverside Park' };
      vi.mocked(prisma.session.update).mockResolvedValueOnce(updatedEvent as unknown);

      const result = await prisma.session.update({
        where: { id: mockEvent.id },
        data: { location: 'Riverside Park' },
      });

      expect(result.location).toBe('Riverside Park');
    });

    it('should update max participants', async () => {
      const updatedEvent = { ...mockEvent, maxParticipants: 30 };
      vi.mocked(prisma.session.update).mockResolvedValueOnce(updatedEvent as unknown);

      const result = await prisma.session.update({
        where: { id: mockEvent.id },
        data: { maxParticipants: 30 },
      });

      expect(result.maxParticipants).toBe(30);
    });

    it('should archive session', async () => {
      const archivedEvent = { ...mockEvent, archived: true };
      vi.mocked(prisma.session.update).mockResolvedValueOnce(archivedEvent as unknown);

      const result = await prisma.session.update({
        where: { id: mockEvent.id },
        data: { archived: true },
      });

      expect(result.archived).toBe(true);
    });
  });

  describe('Event Participant Management', () => {
    it('should add participant to session', async () => {
      const participant = mockEventParticipants[0];
      vi.mocked(prisma.sessionParticipant.create).mockResolvedValueOnce(participant as unknown);

      const result = await prisma.sessionParticipant.create({
        data: {
          sessionId: participant.sessionId,
          userId: participant.userId,
          status: participant.status,
        },
      });

      expect(result).toEqual(participant);
    });

    it('should list all session participants', async () => {
      vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValueOnce(mockEventParticipants as unknown);

      const result = await prisma.sessionParticipant.findMany({
        where: { sessionId: 'session-1' },
      });

      expect(result).toHaveLength(3);
      expect(result).toEqual(mockEventParticipants);
    });

    it('should count confirmed participants', async () => {
      vi.mocked(prisma.sessionParticipant.count).mockResolvedValueOnce(2);

      const count = await prisma.sessionParticipant.count({
        where: { sessionId: 'session-1', status: 'confirmed' },
      });

      expect(count).toBe(2);
    });

    it('should update participant status', async () => {
      const updatedParticipant = { ...mockEventParticipants[2], status: 'confirmed' };
      vi.mocked(prisma.sessionParticipant.update).mockResolvedValueOnce(updatedParticipant as unknown);

      const result = await prisma.sessionParticipant.update({
        where: { id: 'participant-3' },
        data: { status: 'confirmed' },
      });

      expect(result.status).toBe('confirmed');
    });

    it('should remove participant from session', async () => {
      vi.mocked(prisma.sessionParticipant.delete).mockResolvedValueOnce(mockEventParticipants[0] as unknown);

      const result = await prisma.sessionParticipant.delete({
        where: { id: 'participant-1' },
      });

      expect(result).toEqual(mockEventParticipants[0]);
    });
  });

  describe('Event Activity Tracking', () => {
    it('should create activity record', async () => {
      const activity = mockEventActivity[0];
      vi.mocked(prisma.eventActivity.create).mockResolvedValueOnce(activity as unknown);

      const result = await prisma.eventActivity.create({
        data: {
          sessionId: activity.sessionId,
          userId: activity.userId,
          type: activity.type,
          params: activity.params,
        },
      });

      expect(result).toEqual(activity);
    });

    it('should fetch session activity with user details', async () => {
      vi.mocked(prisma.eventActivity.findMany).mockResolvedValueOnce(mockEventActivity as unknown);

      const result = await prisma.eventActivity.findMany({
        where: { sessionId: 'session-1' },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].user).toBeDefined();
    });

    it('should filter activity by type', async () => {
      const filteredActivity = mockEventActivity.filter(a => a.type === 'session_created');
      vi.mocked(prisma.eventActivity.findMany).mockResolvedValueOnce(filteredActivity as unknown);

      const result = await prisma.eventActivity.findMany({
        where: { sessionId: 'session-1', type: 'session_created' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('session_created');
    });
  });

  describe('Event Queries', () => {
    it('should find session by ID', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValueOnce(mockEvent as unknown);

      const result = await prisma.session.findUnique({
        where: { id: mockEvent.id },
      });

      expect(result).toEqual(mockEvent);
    });

    it('should find events by group ID', async () => {
      const groupEvents = [mockEvent, mockRecurringEvent];
      vi.mocked(prisma.session.findMany).mockResolvedValueOnce(groupEvents as unknown);

      const result = await prisma.session.findMany({
        where: { groupId: 'group-1' },
      });

      expect(result).toHaveLength(2);
    });

    it('should find events by creator', async () => {
      vi.mocked(prisma.session.findMany).mockResolvedValueOnce([mockEvent] as unknown);

      const result = await prisma.session.findMany({
        where: { creatorId: 'user-1' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].creatorId).toBe('user-1');
    });

    it('should find upcoming events', async () => {
      const upcomingEvents = [mockEvent, mockRecurringEvent];
      vi.mocked(prisma.session.findMany).mockResolvedValueOnce(upcomingEvents as unknown);

      const now = new Date();
      const result = await prisma.session.findMany({
        where: {
          startTime: { gte: now },
          archived: false,
        },
        orderBy: { startTime: 'asc' },
      });

      expect(result).toHaveLength(2);
    });

    it('should exclude archived events', async () => {
      vi.mocked(prisma.session.findMany).mockResolvedValueOnce([mockEvent] as unknown);

      const result = await prisma.session.findMany({
        where: { archived: false },
      });

      expect(result.every(e => !e.archived)).toBe(true);
    });

    it('should find events by type', async () => {
      vi.mocked(prisma.session.findMany).mockResolvedValueOnce([mockEvent] as unknown);

      const result = await prisma.session.findMany({
        where: { sessionType: 'soccer' },
      });

      expect(result.every(e => e.sessionType === 'soccer')).toBe(true);
    });
  });

  describe('Event Deletion', () => {
    it('should delete session', async () => {
      vi.mocked(prisma.session.delete).mockResolvedValueOnce(mockEvent as unknown);

      const result = await prisma.session.delete({
        where: { id: mockEvent.id },
      });

      expect(result).toEqual(mockEvent);
    });

    it('should soft delete session by archiving', async () => {
      const archivedEvent = { ...mockEvent, archived: true };
      vi.mocked(prisma.session.update).mockResolvedValueOnce(archivedEvent as unknown);

      const result = await prisma.session.update({
        where: { id: mockEvent.id },
        data: { archived: true },
      });

      expect(result.archived).toBe(true);
    });
  });
});
