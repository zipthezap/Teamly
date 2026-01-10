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
 * Generates email verification token
 */
export const generateEmailVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generates password reset token
 */
export const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Checks if account is locked due to failed login attempts
 */
export const isAccountLocked = (user: any) => {
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
  const updateData: any = {
    failedLoginAttempts: newFailedAttempts
  };

  // Lock account if too many failed attempts
  if (newFailedAttempts >= ACCOUNT_LOCKOUT.MAX_ATTEMPTS) {
    const lockoutDuration = ACCOUNT_LOCKOUT.LOCK_DURATION_MINUTES * 60000; // Convert to milliseconds
    updateData.accountLockedUntil = new Date(Date.now() + lockoutDuration);
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData
  });

  return newFailedAttempts;
};

/**
 * Resets failed login attempts on successful login
 */
export const resetFailedLoginAttempts = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      accountLockedUntil: null
    }
  });
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
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
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
      // Reset failed login attempts on password reset
      failedLoginAttempts: 0,
      accountLockedUntil: null
    }
  });
};

/**
 * Validates email verification token and gets user
 */
export const validateEmailVerificationToken = async (token: string) => {
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token
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
  const resetToken = generatePasswordResetToken();
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetToken: resetToken,
      passwordResetExpires: resetTokenExpiry
    }
  });

  return resetToken;
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
      createdAt: true,
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
  const updateData: any = {};
  
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
