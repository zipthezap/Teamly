import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  validateRegistrationInputs,
  sanitizeUserInputs,
  findUserByEmail,
  hashPassword,
  hashToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  isAccountLocked,
  recordFailedLoginAttempt,
  resetFailedLoginAttempts,
  verifyPassword,
  validatePasswordResetToken,
  validateEmailVerificationToken,
  createPasswordResetToken,
  getUserProfile,
  updateUserProfile,
  validateCurrentPassword,
} from '../../services/authService';
import prisma from '../../config/database';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('bcryptjs');

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateRegistrationInputs', () => {
    it('should return valid true for valid inputs', () => {
      const result = validateRegistrationInputs(
        'test@example.com',
        'Password123!',
        'John Doe'
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid false for empty name', () => {
      const result = validateRegistrationInputs(
        'test@example.com',
        'Password123!',
        ''
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Name');
    });

    it('should return valid false for invalid email', () => {
      const result = validateRegistrationInputs(
        'invalid-email',
        'Password123!',
        'John Doe'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Email');
    });

    it('should return valid false for weak password', () => {
      const result = validateRegistrationInputs(
        'test@example.com',
        'weak',
        'John Doe'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sanitizeUserInputs', () => {
    it('should trim and lowercase email', () => {
      const result = sanitizeUserInputs('  TEST@EXAMPLE.COM  ', '  John Doe  ');

      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('John Doe');
    });

    it('should trim whitespace from name', () => {
      const result = sanitizeUserInputs('test@example.com', '  Jane Smith  ');

      expect(result.name).toBe('Jane Smith');
    });
  });

  describe('findUserByEmail', () => {
    it('should find user by email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const result = await findUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user not found', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const result = await findUserByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt', async () => {
      const password = 'myPassword123';
      const hashedPassword = 'hashed_password';

      (bcrypt.hash as any).mockResolvedValue(hashedPassword);

      const result = await hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
    });
  });

  describe('hashToken', () => {
    it('should hash token using SHA256', () => {
      const token = 'test-token-123';
      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');

      const result = hashToken(token);

      expect(result).toBe(expectedHash);
      expect(result.length).toBe(64); // SHA256 produces 64 character hex
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateEmailVerificationToken', () => {
    it('should generate token and hashed token', () => {
      const result = generateEmailVerificationToken();

      expect(result.token).toBeDefined();
      expect(result.hashedToken).toBeDefined();
      expect(result.token.length).toBe(64); // 32 bytes = 64 hex chars
      expect(result.hashedToken.length).toBe(64); // SHA256 hash
      expect(result.token).not.toBe(result.hashedToken);
    });

    it('should generate unique tokens on each call', () => {
      const result1 = generateEmailVerificationToken();
      const result2 = generateEmailVerificationToken();

      expect(result1.token).not.toBe(result2.token);
      expect(result1.hashedToken).not.toBe(result2.hashedToken);
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate token and hashed token', () => {
      const result = generatePasswordResetToken();

      expect(result.token).toBeDefined();
      expect(result.hashedToken).toBeDefined();
      expect(result.token.length).toBe(64);
      expect(result.hashedToken.length).toBe(64);
      expect(result.token).not.toBe(result.hashedToken);
    });

    it('should generate unique tokens on each call', () => {
      const result1 = generatePasswordResetToken();
      const result2 = generatePasswordResetToken();

      expect(result1.token).not.toBe(result2.token);
      expect(result1.hashedToken).not.toBe(result2.hashedToken);
    });
  });

  describe('isAccountLocked', () => {
    it('should return false when accountLockedUntil is null', () => {
      const user: { accountLockedUntil: Date | null } = { accountLockedUntil: null };
      expect(isAccountLocked(user)).toBe(false);
    });

    it('should return true when account is locked in the future', () => {
      const futureDate = new Date(Date.now() + 10000); // 10 seconds in future
      const user: { accountLockedUntil: Date | null } = { accountLockedUntil: futureDate };
      expect(isAccountLocked(user)).toBe(true);
    });

    it('should return false when lock has expired', () => {
      const pastDate = new Date(Date.now() - 10000); // 10 seconds in past
      const user: { accountLockedUntil: Date | null } = { accountLockedUntil: pastDate };
      expect(isAccountLocked(user)).toBe(false);
    });
  });

  describe('recordFailedLoginAttempt', () => {
    it('should increment failed login attempts', async () => {
      const userId = 'user-123';
      (prisma.user.update as any).mockResolvedValue({});

      const result = await recordFailedLoginAttempt(userId, 2);

      expect(result).toBe(3);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          failedLoginAttempts: 3,
        },
      });
    });

    it('should lock account after max attempts', async () => {
      const userId = 'user-123';
      (prisma.user.update as any).mockResolvedValue({});

      const result = await recordFailedLoginAttempt(userId, 4); // 5th attempt

      expect(result).toBe(5);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          failedLoginAttempts: 5,
          accountLockedUntil: expect.any(Date),
        }),
      });
    });
  });

  describe('resetFailedLoginAttempts', () => {
    it('should reset failed login attempts and unlock account', async () => {
      const userId = 'user-123';
      (prisma.user.update as any).mockResolvedValue({});

      await resetFailedLoginAttempts(userId);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          accountLockedUntil: null,
        },
      });
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching passwords', async () => {
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await verifyPassword('password123', 'hashed_password');

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
    });

    it('should return false for non-matching passwords', async () => {
      (bcrypt.compare as any).mockResolvedValue(false);

      const result = await verifyPassword('wrongPassword', 'hashed_password');

      expect(result).toBe(false);
    });
  });

  describe('validatePasswordResetToken', () => {
    it('should return valid true when token matches an unexpired user', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (prisma.user.findFirst as any).mockResolvedValue(mockUser);

      const result = await validatePasswordResetToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('should return valid false when no user found (expired or invalid token)', async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);

      const result = await validatePasswordResetToken('bad-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or expired password reset token');
    });
  });

  describe('validateEmailVerificationToken', () => {
    it('should return valid true for an unverified user with matching token', async () => {
      const mockUser = { id: 'user-1', emailVerified: false };
      (prisma.user.findFirst as any).mockResolvedValue(mockUser);

      const result = await validateEmailVerificationToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('should return valid false when no user found', async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);

      const result = await validateEmailVerificationToken('bad-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid verification token');
    });

    it('should return valid false when email is already verified', async () => {
      const mockUser = { id: 'user-1', emailVerified: true };
      (prisma.user.findFirst as any).mockResolvedValue(mockUser);

      const result = await validateEmailVerificationToken('already-used-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email already verified');
    });
  });

  describe('createPasswordResetToken', () => {
    it('should update user with hashed token and return plain token', async () => {
      (prisma.user.update as any).mockResolvedValue({});

      const token = await createPasswordResetToken('user-1');

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          }),
        })
      );
      // Plain token must differ from stored hash
      const callData = (prisma.user.update as any).mock.calls[0][0].data;
      expect(callData.passwordResetToken).not.toBe(token);
    });
  });

  describe('getUserProfile', () => {
    it('should query user with correct fields', async () => {
      const mockProfile = { id: 'user-1', email: 'test@example.com', name: 'Alice' };
      (prisma.user.findUnique as any).mockResolvedValue(mockProfile);

      const result = await getUserProfile('user-1');

      expect(result).toEqual(mockProfile);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } })
      );
    });

    it('should return null when user is not found', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const result = await getUserProfile('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should update name (trimmed) and emailNotifications', async () => {
      const updated = { id: 'user-1', name: 'Bob', emailNotifications: true };
      (prisma.user.update as any).mockResolvedValue(updated);

      const result = await updateUserProfile('user-1', { name: '  Bob  ', emailNotifications: true });

      expect(result).toEqual(updated);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ name: 'Bob', emailNotifications: true }),
        })
      );
    });

    it('should only update provided fields', async () => {
      (prisma.user.update as any).mockResolvedValue({});

      await updateUserProfile('user-1', { emailNotifications: false });

      const callData = (prisma.user.update as any).mock.calls[0][0].data;
      expect(callData.name).toBeUndefined();
      expect(callData.emailNotifications).toBe(false);
    });
  });

  describe('validateCurrentPassword', () => {
    it('should return true when current password matches', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ password: 'hashed' });
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await validateCurrentPassword('user-1', 'correct-password');

      expect(result).toBe(true);
    });

    it('should return false when user is not found', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const result = await validateCurrentPassword('user-1', 'any-password');

      expect(result).toBe(false);
    });

    it('should return false when password does not match', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ password: 'hashed' });
      (bcrypt.compare as any).mockResolvedValue(false);

      const result = await validateCurrentPassword('user-1', 'wrong-password');

      expect(result).toBe(false);
    });
  });
});
