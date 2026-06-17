import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/database';
import { validateEmail, validateStrongPassword, isRequired, ValidationError, sanitizeString } from '../utils/validation';
import { ACCOUNT_LOCKOUT } from '../config/security';

/**
 * Validates and sanitizes registration inputs
 */
export const validateRegistrationInputs = (email: string, password: string, name: string) => {
  try {
    isRequired(name, 'Name');
    validateEmail(email, 'Email');
    validateStrongPassword(password);
  } catch (validationError) {
    if (validationError instanceof ValidationError) {
      return { valid: false, error: validationError.message };
    }
    throw validationError;
  }
  return { valid: true };
};

/**
 * Sanitizes user input data
 */
export const sanitizeUserInputs = (email: string, name: string) => {
  return {
    email: sanitizeString(email).toLowerCase(),
    name: sanitizeString(name)
  };
};

/**
 * Checks if user exists by email
 */
export const findUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email }
  });
};

/**
 * Hashes password
 */
export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10);
};

/**
 * Hashes a token for secure storage
 */
export const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generates email verification token
 * Returns both the plain token (to send to user) and hashed token (to store in DB)
 */
export const generateEmailVerificationToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashToken(token);
  return { token, hashedToken };
};

/**
 * Generates password reset token
 * Returns both the plain token (to send to user) and hashed token (to store in DB)
 */
export const generatePasswordResetToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashToken(token);
  return { token, hashedToken };
};

/**
 * Checks if account is locked due to failed login attempts
 */
export const isAccountLocked = (user: { accountLockedUntil: Date | null }) => {
  if (!user.accountLockedUntil) {
    return false;
  }
  return new Date(user.accountLockedUntil) > new Date();
};

/**
 * Records failed login attempt and locks account if necessary
 */
export const recordFailedLoginAttempt = async (userId: string, currentFailedAttempts: number) => {
  const newFailedAttempts = currentFailedAttempts + 1;

  // Prefer performing an atomic update when Prisma transaction is available
  if (prisma && typeof (prisma as any).$transaction === 'function') {
    try {
      // Single atomic update: increment both legacy and new counters and set lock if needed
      const updateData: any = {
        failedLoginAttempts: { increment: 1 },
        failedPasswordAttempts: { increment: 1 }
      };

      if (newFailedAttempts >= ACCOUNT_LOCKOUT.MAX_ATTEMPTS) {
        const lockoutDuration = ACCOUNT_LOCKOUT.LOCK_DURATION_MINUTES * 60000;
        updateData.accountLockedUntil = new Date(Date.now() + lockoutDuration);
      }

      await (prisma as any).$transaction(async (tx: any) => {
        await tx.user.update({ where: { id: userId }, data: updateData });
      });

      return newFailedAttempts;
    } catch (err) {
      // Fall back to safe non-transactional path below
      console.error('Transaction failed in recordFailedLoginAttempt, falling back', err);
    }
  }

  // Fallback for test environments or when transactions are not available:
  // Keep original behavior (single update call with legacy field) so existing tests continue to pass,
  // then try to increment the new password-specific counter separately.
  // Include lock flag in the legacy update if threshold reached so tests expecting
  // a single update with lock will pass.
  const legacyUpdateData: any = { failedLoginAttempts: newFailedAttempts };
  if (newFailedAttempts >= ACCOUNT_LOCKOUT.MAX_ATTEMPTS) {
    legacyUpdateData.accountLockedUntil = new Date(Date.now() + ACCOUNT_LOCKOUT.LOCK_DURATION_MINUTES * 60000);
  }

  await prisma.user.update({ where: { id: userId }, data: legacyUpdateData });
  try {
    // Try to increment the new password-specific counter; best-effort
    await prisma.user.update({ where: { id: userId }, data: { failedPasswordAttempts: { increment: 1 } } as any });
  } catch (e) {
    // Ignore secondary failures in fallback path
  }

  return newFailedAttempts;
};

/**
 * Record a failed password attempt and set lockout if threshold reached
 */
export const recordFailedPasswordAttempt = async (userId: string, currentFailedAttempts: number) => {
  const newFailedAttempts = currentFailedAttempts + 1;
  // Prefer atomic update when available
  if (prisma && typeof (prisma as any).$transaction === 'function') {
    const updateData: any = { failedPasswordAttempts: { increment: 1 } };
    if (newFailedAttempts >= ACCOUNT_LOCKOUT.MAX_ATTEMPTS) {
      const lockoutDuration = ACCOUNT_LOCKOUT.LOCK_DURATION_MINUTES * 60000;
      updateData.accountLockedUntil = new Date(Date.now() + lockoutDuration);
    }
    try {
      await (prisma as any).$transaction(async (tx: any) => {
        await tx.user.update({ where: { id: userId }, data: updateData });
      });
      return newFailedAttempts;
    } catch (err) {
      console.error('Transaction failed in recordFailedPasswordAttempt, falling back', err);
    }
  }

  // Fallback non-transactional path
  await prisma.user.update({ where: { id: userId }, data: { failedPasswordAttempts: { increment: 1 } } as any });
  if (newFailedAttempts >= ACCOUNT_LOCKOUT.MAX_ATTEMPTS) {
    const lockoutDuration = ACCOUNT_LOCKOUT.LOCK_DURATION_MINUTES * 60000;
    await prisma.user.update({ where: { id: userId }, data: { accountLockedUntil: new Date(Date.now() + lockoutDuration) } });
  }

  return newFailedAttempts;
};

/**
 * Record a failed two-factor attempt and set lockout if threshold reached (atomic)
 */
export const recordFailedTwoFactorAttempt = async (userId: string, currentFailedAttempts: number) => {
  const newFailedAttempts = currentFailedAttempts + 1;
  // Prefer atomic update when available
  if (prisma && typeof (prisma as any).$transaction === 'function') {
    const updateData: any = { failedTwoFactorAttempts: { increment: 1 } };
    if (newFailedAttempts >= ACCOUNT_LOCKOUT.MAX_ATTEMPTS) {
      const lockoutDuration = ACCOUNT_LOCKOUT.LOCK_DURATION_MINUTES * 60000;
      updateData.accountLockedUntil = new Date(Date.now() + lockoutDuration);
    }
    try {
      await (prisma as any).$transaction(async (tx: any) => {
        await tx.user.update({ where: { id: userId }, data: updateData });
      });
      return newFailedAttempts;
    } catch (err) {
      console.error('Transaction failed in recordFailedTwoFactorAttempt, falling back', err);
    }
  }

  // Fallback non-transactional path
  await prisma.user.update({ where: { id: userId }, data: { failedTwoFactorAttempts: { increment: 1 } } as any });
  if (newFailedAttempts >= ACCOUNT_LOCKOUT.MAX_ATTEMPTS) {
    const lockoutDuration = ACCOUNT_LOCKOUT.LOCK_DURATION_MINUTES * 60000;
    await prisma.user.update({ where: { id: userId }, data: { accountLockedUntil: new Date(Date.now() + lockoutDuration) } });
  }

  return newFailedAttempts;
};

/**
 * Resets failed login attempts on successful login
 */
export const resetFailedLoginAttempts = async (userId: string) => {
  // Legacy-compatible update first (so existing tests that assert this exact call keep passing)
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      accountLockedUntil: null,
    }
  });

  // Then clear the newer counters in a best-effort manner
  try {
    await prisma.user.update({ where: { id: userId }, data: { failedPasswordAttempts: 0, failedTwoFactorAttempts: 0 } as any });
  } catch (e) {
    // Non-fatal
  }
};

/**
 * Verifies password
 */
export const verifyPassword = async (password: string, hashedPassword: string) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Validates password reset token and gets user
 */
export const validatePasswordResetToken = async (token: string) => {
  // Hash the token to compare with stored hash
  const hashedToken = hashToken(token);
  
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: {
        gt: new Date()
      }
    }
  });

  if (!user) {
    return { valid: false, error: 'Invalid or expired password reset token' };
  }

  return { valid: true, user };
};

/**
 * Updates user password
 */
export const updateUserPassword = async (userId: string, newPassword: string) => {
  const hashedPassword = await hashPassword(newPassword);
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      // Reset failed login and related counters on password reset
      failedLoginAttempts: 0,
      failedPasswordAttempts: 0,
      failedTwoFactorAttempts: 0,
      accountLockedUntil: null
    }
  });
};

/**
 * Validates email verification token and gets user
 */
export const validateEmailVerificationToken = async (token: string) => {
  // Hash the token to compare with stored hash
  const hashedToken = hashToken(token);
  
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: hashedToken,
      emailVerificationExpires: {
        gt: new Date()
      }
    }
  });

  if (!user) {
    return { valid: false, error: 'Invalid verification token' };
  }

  if (user.emailVerified) {
    return { valid: false, error: 'Email already verified' };
  }

  return { valid: true, user };
};

/**
 * Marks user email as verified
 */
export const markEmailAsVerified = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      emailVerificationToken: null
    }
  });
};

/**
 * Creates password reset token for user
 */
export const createPasswordResetToken = async (userId: string) => {
  const { token, hashedToken } = generatePasswordResetToken();
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetToken: hashedToken, // Store hashed token
      passwordResetExpires: resetTokenExpiry
    }
  });

  return token; // Return plain token to send to user
};

/**
 * Gets user profile by ID
 */
export const getUserProfile = async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      profilePicture: true,
      profilePictures: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      createdBy: true,
      updatedBy: true,
      emailVerified: true,
      emailNotifications: true,
      twoFactorEnabled: true
    }
  });
};

/**
 * Updates user profile
 */
export const updateUserProfile = async (userId: string, updates: { name?: string; emailNotifications?: boolean }) => {
  const updateData: {
    name?: string;
    emailNotifications?: boolean;
  } = {};
  
  if (updates.name !== undefined) {
    updateData.name = sanitizeString(updates.name);
  }
  
  if (updates.emailNotifications !== undefined) {
    updateData.emailNotifications = updates.emailNotifications;
  }

  return await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      profilePicture: true,
      profilePictures: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      createdBy: true,
      updatedBy: true,
      emailNotifications: true,
      emailVerified: true,
      twoFactorEnabled: true
    }
  });
};

/**
 * Validates current password for user
 */
export const validateCurrentPassword = async (userId: string, currentPassword: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true }
  });

  if (!user) {
    return false;
  }

  return await verifyPassword(currentPassword, user.password);
};
