/**
 * Authentication Controller
 * 
 * This controller handles all authentication and user management operations including:
 * - User registration and login (with 2FA support)
 * - Password management (update, reset, recovery)
 * - Email verification
 * - Token management (access, refresh, logout)
 * - Session management
 * - Profile management (view, update)
 * - Profile picture management (upload, delete, restore)
 * - OAuth integration (Google, Facebook, Apple)
 * - Mobile OAuth token exchange (Google, Facebook, Apple)
 */

import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import prisma from '../config/database';
import { PASSWORD_RESET } from '../config/security';
import { revokeAllUserTokens } from '../utils/jwt';
import { logger } from '../utils/logger';
import { validateEmail, validateStrongPassword, isRequired, ValidationError, sanitizeString } from '../utils/validation';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import crypto from 'crypto';
import { sendEmail } from '../utils/emailService';
import * as authService from '../services/authService';

export const updatePassword = async (req: Request, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword) {
    throw new BadRequestError('New password is required');
  }

  // Validate strong password
  try {
    validateStrongPassword(newPassword);
  } catch (validationError) {
    if (validationError instanceof ValidationError) {
      throw new BadRequestError(validationError.message);
    }
    throw validationError;
  }

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, password: true, authProvider: true }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // If user has a password (not OAuth-only), verify current password
  if (user.password) {
    if (!currentPassword) {
      throw new BadRequestError('Current password is required');
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Current password is incorrect');
    }
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  // Note: We keep the authProvider as is (google/facebook) even when setting password
  // This preserves the information about how the user originally signed up
  // The user can now authenticate with either OAuth or password
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { password: hashedPassword }
  });

  // Revoke all existing tokens for security (except current one for convenience)
  await revokeAllUserTokens(req.user!.id, 'password_change');

  logger.info('Password changed', 'AuthController', { userId: req.user!.id });
  res.json({ message: 'Password updated successfully. You have been logged out from other devices for security.' });
};

/**
 * Request password reset - sends email with reset token
 */
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  // Validate input
  try {
    validateEmail(email, 'Email');
  } catch (validationError) {
    if (validationError instanceof ValidationError) {
      throw new BadRequestError(validationError.message);
    }
    throw validationError;
  }

  const sanitizedEmail = sanitizeString(email).toLowerCase();
  
  const user = await prisma.user.findUnique({
    where: { email: sanitizedEmail }
  });

  // Don't reveal if user exists or not for security
  if (!user) {
    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
    return;
  }

  // Generate reset token using crypto
  const crypto = await import('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Token expires based on configuration (default: 1 hour)
  const expiresAt = new Date(Date.now() + PASSWORD_RESET.TOKEN_EXPIRY_HOURS * 3600000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpires: expiresAt
    }
  });

  // Send password reset email
  const { sendEmail } = await import('../utils/emailService');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  // Optionally include a mobile deep-link when MOBILE_APP_SCHEME is configured
  // e.g. MOBILE_APP_SCHEME=teamly  →  teamly://reset-password/TOKEN
  const mobileScheme = process.env.MOBILE_APP_SCHEME;
  const mobileSection = mobileScheme
    ? `<p>Using the Teamly mobile app? <a href="${mobileScheme}://reset-password/${resetToken}">Open in app</a></p>`
    : '';

  await sendEmail(
    user.email,
    'Password Reset Request',
    `
      <h2>Password Reset Request</h2>
      <p>Hi ${user.name},</p>
      <p>You requested to reset your password. Click the link below to reset it:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      ${mobileSection}
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  );

  logger.info('Password reset requested', 'AuthController', { userId: user.id });
  res.json({ 
    message: 'If an account with that email exists, a password reset link has been sent.' 
  });
};

/**
 * Reset password with token
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, newPassword } = req.body;

  // Validate inputs
  try {
    isRequired(token, 'Reset token');
    validateStrongPassword(newPassword);
  } catch (validationError) {
    if (validationError instanceof ValidationError) {
      throw new BadRequestError(validationError.message);
    }
    throw validationError;
  }

  // Hash the token to compare with stored hash
  const crypto = await import('crypto');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: {
        gt: new Date()
      }
    }
  });

  if (!user) {
    throw new BadRequestError('Invalid or expired reset token');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password and clear reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      failedLoginAttempts: 0,
      failedPasswordAttempts: 0,
      failedTwoFactorAttempts: 0,
      accountLockedUntil: null
    }
  });

  logger.info('Password reset successful', 'AuthController', { userId: user.id });
  
  // Revoke all existing tokens for security
  await revokeAllUserTokens(user.id, 'password_reset');
  
  res.json({ message: 'Password has been reset successfully. Please login with your new password.' });
};

/**
 * Verify email with token
 */
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body;

  if (!token) {
    throw new BadRequestError('Verification token is required');
  }

  // Hash the incoming plain token before comparing to the stored hashed token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: hashedToken,
      emailVerified: false,
      emailVerificationExpires: { gt: new Date() }
    }
  });

  if (!user) {
    throw new BadRequestError('Invalid or expired verification token');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null
    }
  });

  logger.info('Email verified', 'AuthController', { userId: user.id });
  res.json({ message: 'Email verified successfully' });
};

/**
 * Resend email verification
 */
export const resendVerificationEmail = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true, emailVerified: true }
  });

  if (!user) {
    // Don't reveal if user exists
    res.json({ message: 'If an account exists, a verification email has been sent.' });
    return;
  }

  if (user.emailVerified) {
    throw new BadRequestError('Email is already verified');
  }

  // Generate new verification token (plain for the email URL, hashed for DB storage)
  const { token: emailVerificationToken, hashedToken: hashedEmailToken } = authService.generateEmailVerificationToken();
  
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: hashedEmailToken, emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) }
  });

  // Send verification email with the plain token
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const verificationUrl = `${frontendUrl}/verify-email?token=${emailVerificationToken}`;
  
  await sendEmail(
    user.email,
    'Verify Your Email Address',
    `
      <h2>Email Verification</h2>
      <p>Hi ${user.name},</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p>This link will expire in 24 hours.</p>
    `
  );

  res.json({ message: 'Verification email sent' });
};

/**
 * Refresh access token using refresh token
 */
