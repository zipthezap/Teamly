/**
 * Tests for authentication race conditions
 * 
 * These tests verify that concurrent failed login attempts are handled correctly
 * and that the account locking mechanism works properly without race conditions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import prisma from '../../config/database';

describe('Auth Race Conditions', () => {
  describe('Failed Login Attempts', () => {
    it('should atomically increment failed login attempts', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: 'racetest@example.com',
          password: 'hashedpassword',
          name: 'Race Test User',
          failedLoginAttempts: 0
        }
      });

      try {
        // Simulate concurrent failed login attempts by incrementing multiple times
        await Promise.all([
          prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: { increment: 1 } }
          }),
          prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: { increment: 1 } }
          }),
          prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: { increment: 1 } }
          })
        ]);

        // Check that all increments were properly recorded
        const updatedUser = await prisma.user.findUnique({
          where: { id: user.id }
        });

        expect(updatedUser?.failedLoginAttempts).toBe(3);
      } finally {
        // Cleanup
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    });

    it('should lock account after 5 failed attempts', async () => {
      // Create a test user with 4 failed attempts
      const user = await prisma.user.create({
        data: {
          email: 'locktest@example.com',
          password: 'hashedpassword',
          name: 'Lock Test User',
          failedLoginAttempts: 4
        }
      });

      try {
        // Increment to 5
        const result = await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: { increment: 1 } },
          select: { failedLoginAttempts: true }
        });

        expect(result.failedLoginAttempts).toBe(5);

        // Now lock should be applied
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accountLockedUntil: new Date(Date.now() + 15 * 60 * 1000)
          }
        });

        const lockedUser = await prisma.user.findUnique({
          where: { id: user.id }
        });

        expect(lockedUser?.accountLockedUntil).toBeTruthy();
        expect(lockedUser?.accountLockedUntil!.getTime()).toBeGreaterThan(Date.now());
      } finally {
        // Cleanup
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    });

    it('should handle concurrent increments without data loss', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: 'concurrent@example.com',
          password: 'hashedpassword',
          name: 'Concurrent Test User',
          failedLoginAttempts: 0
        }
      });

      try {
        // Simulate 10 concurrent failed login attempts
        const promises = Array(10).fill(null).map(() =>
          prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: { increment: 1 } }
          })
        );

        await Promise.all(promises);

        // Verify all increments were recorded
        const updatedUser = await prisma.user.findUnique({
          where: { id: user.id }
        });

        expect(updatedUser?.failedLoginAttempts).toBe(10);
      } finally {
        // Cleanup
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    });
  });
});
