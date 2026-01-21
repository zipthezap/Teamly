/**
 * Email Queue Service Tests
 * Tests for the email queuing and delivery service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies - must be at the top level
vi.mock('../../config/database', () => ({
  default: {
    emailQueue: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn()
    }
  }
}));

vi.mock('../../utils/emailService', () => ({
  sendEmail: vi.fn()
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('../../config/security', () => ({
  EMAIL_RETRY: {
    BASE_DELAY_MS: 1000,
    BACKOFF_MULTIPLIER: 2
  }
}));

vi.mock('../../utils/circuitBreaker', () => ({
  emailCircuitBreaker: {
    execute: vi.fn((fn) => fn())
  }
}));

import { sendEmail as sendEmailDirect } from '../../utils/emailService';
import prisma from '../../config/database';
import {
  enqueueEmail,
  processEmail,
  processPendingEmails,
  getQueueStats,
  cleanupOldEmails,
  retryFailedEmails,
  sendEmailWithQueue,
  startEmailQueueProcessor,
  stopEmailQueueProcessor
} from '../../services/emailQueueService';

const mockPrisma = vi.mocked(prisma);

describe('EmailQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enqueueEmail', () => {
    it('should enqueue an email successfully', async () => {
      const mockEmail = {
        id: 'email-123',
        recipient: 'user@example.com',
        subject: 'Test Email',
        htmlContent: '<p>Test</p>',
        textContent: 'Test',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        scheduledAt: new Date(),
        createdAt: new Date()
      };

      mockPrisma.emailQueue.create.mockResolvedValue(mockEmail);

      const emailId = await enqueueEmail({
        recipient: 'user@example.com',
        subject: 'Test Email',
        htmlContent: '<p>Test</p>'
      });

      expect(emailId).toBe('email-123');
      expect(mockPrisma.emailQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipient: 'user@example.com',
          subject: 'Test Email',
          htmlContent: '<p>Test</p>',
          maxAttempts: 3,
          status: 'pending'
        })
      });
    });

    it('should enqueue with custom options', async () => {
      const mockEmail = {
        id: 'email-456',
        recipient: 'test@example.com',
        subject: 'Custom Email',
        htmlContent: '<p>Custom</p>',
        textContent: 'Custom',
        templateType: 'welcome',
        templateData: { name: 'John' },
        status: 'pending',
        attempts: 0,
        maxAttempts: 5,
        scheduledAt: new Date(),
        createdAt: new Date()
      };

      mockPrisma.emailQueue.create.mockResolvedValue(mockEmail);

      const scheduledAt = new Date(Date.now() + 3600000);
      await enqueueEmail({
        recipient: 'test@example.com',
        subject: 'Custom Email',
        htmlContent: '<p>Custom</p>',
        textContent: 'Custom',
        templateType: 'welcome',
        templateData: { name: 'John' },
        maxAttempts: 5,
        scheduledAt
      });

      expect(mockPrisma.emailQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          maxAttempts: 5,
          templateType: 'welcome'
        })
      });
    });

    it('should throw error if enqueueing fails', async () => {
      mockPrisma.emailQueue.create.mockRejectedValue(new Error('Database error'));

      await expect(enqueueEmail({
        recipient: 'test@example.com',
        subject: 'Test',
        htmlContent: '<p>Test</p>'
      })).rejects.toThrow('Database error');
    });
  });

  describe('processEmail', () => {
    it('should process and send email successfully', async () => {
      const mockEmail = {
        id: 'email-123',
        recipient: 'user@example.com',
        subject: 'Test Email',
        htmlContent: '<p>Test</p>',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3
      };

      mockPrisma.emailQueue.findUnique.mockResolvedValue(mockEmail);
      mockPrisma.emailQueue.update.mockResolvedValue({ ...mockEmail, status: 'sent' });
      vi.mocked(sendEmailDirect).mockResolvedValue();

      const result = await processEmail('email-123');

      expect(result).toBe(true);
      expect(mockPrisma.emailQueue.update).toHaveBeenCalledWith({
        where: { id: 'email-123' },
        data: expect.objectContaining({
          status: 'sent',
          lastError: null
        })
      });
    });

    it('should return false if email not found', async () => {
      mockPrisma.emailQueue.findUnique.mockResolvedValue(null);

      const result = await processEmail('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false if email already sent', async () => {
      const mockEmail = {
        id: 'email-123',
        status: 'sent',
        attempts: 1,
        maxAttempts: 3
      };

      mockPrisma.emailQueue.findUnique.mockResolvedValue(mockEmail);

      const result = await processEmail('email-123');

      expect(result).toBe(false);
      expect(sendEmailDirect).not.toHaveBeenCalled();
    });

    it('should return false if max attempts reached', async () => {
      const mockEmail = {
        id: 'email-123',
        status: 'retry',
        attempts: 3,
        maxAttempts: 3
      };

      mockPrisma.emailQueue.findUnique.mockResolvedValue(mockEmail);

      const result = await processEmail('email-123');

      expect(result).toBe(false);
      expect(sendEmailDirect).not.toHaveBeenCalled();
    });

    it('should handle send failure and schedule retry', async () => {
      const mockEmail = {
        id: 'email-123',
        recipient: 'user@example.com',
        subject: 'Test Email',
        htmlContent: '<p>Test</p>',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        scheduledAt: new Date()
      };

      mockPrisma.emailQueue.findUnique.mockResolvedValue(mockEmail);
      mockPrisma.emailQueue.update.mockResolvedValue({ ...mockEmail, status: 'retry' });
      vi.mocked(sendEmailDirect).mockRejectedValue(new Error('SMTP error'));

      const result = await processEmail('email-123');

      expect(result).toBe(false);
      expect(mockPrisma.emailQueue.update).toHaveBeenCalledWith({
        where: { id: 'email-123' },
        data: expect.objectContaining({
          status: 'retry',
          lastError: 'SMTP error'
        })
      });
    });

    it('should mark as failed after max attempts', async () => {
      const mockEmail = {
        id: 'email-123',
        recipient: 'user@example.com',
        subject: 'Test Email',
        htmlContent: '<p>Test</p>',
        status: 'retry',
        attempts: 2,
        maxAttempts: 3,
        scheduledAt: new Date()
      };

      mockPrisma.emailQueue.findUnique.mockResolvedValue(mockEmail);
      mockPrisma.emailQueue.update.mockResolvedValue({ ...mockEmail, status: 'failed' });
      vi.mocked(sendEmailDirect).mockRejectedValue(new Error('SMTP error'));

      const result = await processEmail('email-123');

      expect(result).toBe(false);
      expect(mockPrisma.emailQueue.update).toHaveBeenCalledWith({
        where: { id: 'email-123' },
        data: expect.objectContaining({
          status: 'failed'
        })
      });
    });
  });

  describe('processPendingEmails', () => {
    it('should process multiple pending emails', async () => {
      const mockEmails = [
        {
          id: 'email-1',
          recipient: 'user1@example.com',
          subject: 'Email 1',
          htmlContent: '<p>Email 1</p>',
          status: 'pending',
          attempts: 0,
          maxAttempts: 3,
          scheduledAt: new Date()
        },
        {
          id: 'email-2',
          recipient: 'user2@example.com',
          subject: 'Email 2',
          htmlContent: '<p>Email 2</p>',
          status: 'pending',
          attempts: 0,
          maxAttempts: 3,
          scheduledAt: new Date()
        }
      ];

      mockPrisma.emailQueue.findMany.mockResolvedValue(mockEmails);
      mockPrisma.emailQueue.findUnique
        .mockResolvedValueOnce(mockEmails[0])
        .mockResolvedValueOnce(mockEmails[1]);
      mockPrisma.emailQueue.update.mockResolvedValue({});
      vi.mocked(sendEmailDirect).mockResolvedValue();

      await processPendingEmails();

      expect(mockPrisma.emailQueue.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { status: 'pending' },
            { status: 'retry' }
          ]
        }),
        take: 50,
        orderBy: { scheduledAt: 'asc' }
      });
    });

    it('should filter out emails that exceeded max attempts', async () => {
      const mockEmails = [
        {
          id: 'email-1',
          attempts: 0,
          maxAttempts: 3
        },
        {
          id: 'email-2',
          attempts: 3,
          maxAttempts: 3
        }
      ];

      mockPrisma.emailQueue.findMany.mockResolvedValue(mockEmails);
      mockPrisma.emailQueue.findUnique.mockResolvedValue(mockEmails[0]);
      mockPrisma.emailQueue.update.mockResolvedValue({});
      vi.mocked(sendEmailDirect).mockResolvedValue();

      await processPendingEmails();

      // Should only process email-1
      expect(mockPrisma.emailQueue.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      mockPrisma.emailQueue.groupBy.mockResolvedValue([
        { status: 'pending', _count: 10 },
        { status: 'sent', _count: 50 },
        { status: 'failed', _count: 5 }
      ]);

      const stats = await getQueueStats();

      expect(stats).toEqual({
        pending: 10,
        sent: 50,
        failed: 5
      });
    });

    it('should return empty object on error', async () => {
      mockPrisma.emailQueue.groupBy.mockRejectedValue(new Error('Database error'));

      const stats = await getQueueStats();

      expect(stats).toEqual({});
    });
  });

  describe('cleanupOldEmails', () => {
    it('should delete old sent emails', async () => {
      mockPrisma.emailQueue.deleteMany.mockResolvedValue({ count: 25 });

      await cleanupOldEmails();

      expect(mockPrisma.emailQueue.deleteMany).toHaveBeenCalledWith({
        where: {
          status: 'sent',
          sentAt: {
            lt: expect.any(Date)
          }
        }
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      mockPrisma.emailQueue.deleteMany.mockRejectedValue(new Error('Database error'));

      await expect(cleanupOldEmails()).resolves.not.toThrow();
    });
  });

  describe('retryFailedEmails', () => {
    it('should reset eligible failed emails to retry', async () => {
      const failedEmails = [
        {
          id: 'email-1',
          attempts: 2,
          maxAttempts: 3,
          status: 'failed'
        },
        {
          id: 'email-2',
          attempts: 3,
          maxAttempts: 3,
          status: 'failed'
        }
      ];

      mockPrisma.emailQueue.findMany.mockResolvedValue(failedEmails);
      mockPrisma.emailQueue.update.mockResolvedValue({});

      await retryFailedEmails();

      // Should only retry email-1
      expect(mockPrisma.emailQueue.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.emailQueue.update).toHaveBeenCalledWith({
        where: { id: 'email-1' },
        data: expect.objectContaining({
          status: 'retry'
        })
      });
    });

    it('should handle retry errors gracefully', async () => {
      mockPrisma.emailQueue.findMany.mockRejectedValue(new Error('Database error'));

      await expect(retryFailedEmails()).resolves.not.toThrow();
    });
  });

  describe('sendEmailWithQueue', () => {
    it('should send email immediately when immediate option is true', async () => {
      vi.mocked(sendEmailDirect).mockResolvedValue();

      await sendEmailWithQueue(
        'user@example.com',
        'Test',
        '<p>Test</p>',
        { immediate: true }
      );

      expect(sendEmailDirect).toHaveBeenCalledWith(
        'user@example.com',
        'Test',
        '<p>Test</p>'
      );
      expect(mockPrisma.emailQueue.create).not.toHaveBeenCalled();
    });

    it('should enqueue email when immediate option is false', async () => {
      mockPrisma.emailQueue.create.mockResolvedValue({
        id: 'email-123'
      });

      await sendEmailWithQueue(
        'user@example.com',
        'Test',
        '<p>Test</p>'
      );

      expect(mockPrisma.emailQueue.create).toHaveBeenCalled();
      expect(sendEmailDirect).not.toHaveBeenCalled();
    });

    it('should pass custom options when enqueueing', async () => {
      mockPrisma.emailQueue.create.mockResolvedValue({
        id: 'email-123'
      });

      await sendEmailWithQueue(
        'user@example.com',
        'Test',
        '<p>Test</p>',
        {
          textContent: 'Test',
          templateType: 'welcome',
          maxAttempts: 5
        }
      );

      expect(mockPrisma.emailQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          textContent: 'Test',
          templateType: 'welcome',
          maxAttempts: 5
        })
      });
    });
  });

  describe('Queue Processor', () => {
    it('should start and stop email queue processor', () => {
      vi.useFakeTimers();

      const interval = startEmailQueueProcessor();

      expect(interval).toBeDefined();

      stopEmailQueueProcessor(interval);

      vi.useRealTimers();
    });
  });
});
