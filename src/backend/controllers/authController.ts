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
 * - OAuth integration (Google, Facebook)
 */

import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import prisma from '../config/database';
import { PASSWORD_RESET } from '../config/security';
import { generateTokenPair, revokeToken, revokeAllUserTokens, refreshAccessToken } from '../utils/jwt';
import { validate2FAToken } from './twoFactorController';
import { logger } from '../utils/logger';
import { validateEmail, validateStrongPassword, isRequired, ValidationError, sanitizeString } from '../utils/validation';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import crypto from 'crypto';
import { sendEmail } from '../utils/emailService';
import path from 'path';
import { 
  validateImage, 
  processImage, 
  deleteFile, 
  deleteOldPicture,
  generateUniqueFilename 
} from '../utils/imageProcessor';
import { UPLOAD_CONFIG } from '../config/upload';
import * as authService from '../services/authService';

// ==================== REGISTRATION & LOGIN ====================

export const register = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  const { email, password, name } = req.body;

  // Validate and sanitize inputs
  const validation = authService.validateRegistrationInputs(email, password, name);
  if (!validation.valid) {
    throw new BadRequestError(validation.error!);
  }

  // Sanitize string inputs
  const sanitized = authService.sanitizeUserInputs(email, name);

  const existingUser = await authService.findUserByEmail(sanitized.email);

  if (existingUser) {
    throw new BadRequestError('User already exists');
  }

  const hashedPassword = await authService.hashPassword(password);

  // Generate email verification token (returns plain and hashed versions)
  const { token: emailVerificationToken, hashedToken: hashedEmailToken } = authService.generateEmailVerificationToken();

  const user = await prisma.user.create({
    data: {
      email: sanitized.email,
      password: hashedPassword,
      name: sanitized.name,
      emailVerificationToken: hashedEmailToken // Store hashed token
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      emailVerified: true
    }
  });

  // Send verification email with plain token
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const verificationUrl = `${frontendUrl}/verify-email?token=${emailVerificationToken}`;
  
  await sendEmail(
    user.email,
    'Verify Your Email Address',
    `
      <h2>Welcome to Teamly!</h2>
      <p>Hi ${user.name},</p>
      <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't register for Teamly, please ignore this email.</p>
    `
  );

  // Generate tokens
  const deviceInfo = req.headers['user-agent'];
  const ipAddress = req.ip;
  const tokens = await generateTokenPair(user.id, deviceInfo, ipAddress);

  res.status(201).json({ 
    user, 
    ...tokens,
    message: 'Registration successful. Please check your email to verify your account.' 
  });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password, twoFactorToken } = req.body;

  // Validate inputs
  try {
    validateEmail(email, 'Email');
    isRequired(password, 'Password');
  } catch (validationError) {
    if (validationError instanceof ValidationError) {
      throw new BadRequestError(validationError.message);
    }
    throw validationError;
  }

  // Sanitize email
  const sanitizedEmail = sanitizeString(email).toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: sanitizedEmail }
  });

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Check if account is locked
  if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
    throw new UnauthorizedError('Account is temporarily locked due to too many failed login attempts');
  }

  // Validate password
  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    // Atomically increment failed login attempts to prevent race conditions
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: { increment: 1 }
      },
      select: { failedLoginAttempts: true }
    });

    // Check if account should be locked after atomic increment
    const lockAccount = updatedUser.failedLoginAttempts >= 5;
    if (lockAccount) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accountLockedUntil: new Date(Date.now() + 15 * 60 * 1000) // Lock for 15 minutes
        }
      });
    }

    throw new UnauthorizedError('Invalid credentials');
  }

  // Reset failed login attempts on successful password validation
  if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        accountLockedUntil: null
      }
    });
  }

  // Check if 2FA is enabled
  if (user.twoFactorEnabled) {
    if (!twoFactorToken) {
      // Return a flag indicating 2FA is required without exposing the user ID
      res.status(200).json({
        requires2FA: true,
        // Note: In production, consider using a temporary session token instead
        tempAuth: email // Use email instead of userId for the second request
      });
      return;
    }

    // Validate 2FA token
    const validation = await validate2FAToken(user.id, twoFactorToken);

    if (!validation.valid) {
      throw new UnauthorizedError(validation.error || 'Invalid 2FA token');
    }
  }

  // Generate token pair with session tracking
  const deviceInfo = req.headers['user-agent'];
  const ipAddress = req.ip;
  const tokens = await generateTokenPair(user.id, deviceInfo, ipAddress);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    },
    ...tokens
  });
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  // Include authProvider and OAuth status in profile response
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      profilePicture: true,
      city: true,
      country: true,
      address: true,
      postalCode: true,
      discoveryRadius: true,
      createdAt: true,
      emailVerified: true,
      emailNotifications: true,
      twoFactorEnabled: true,
      authProvider: true,
      googleId: true,
      facebookId: true,
      lastOAuthSync: true
    }
  });
  
  res.json({ user });
};

// ==================== PROFILE MANAGEMENT ====================

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const { name, email, city, country, address, postalCode, discoveryRadius } = req.body;

  if (!name || !email) {
    throw new BadRequestError('Name and email are required');
  }

  // Check if email is already taken by another user
  if (email !== req.user!.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new BadRequestError('Email already in use');
    }
  }

  // Validate discoveryRadius if provided
  if (discoveryRadius !== undefined) {
    const radius = parseInt(discoveryRadius);
    if (isNaN(radius) || radius < 1 || radius > 200) {
      throw new BadRequestError('Discovery radius must be between 1 and 200 km');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user!.id },
    data: { 
      name, 
      email,
      city: city || null,
      country: country || null,
      address: address || null,
      postalCode: postalCode || null,
      discoveryRadius: discoveryRadius !== undefined ? parseInt(discoveryRadius) : undefined
    },
    select: {
      id: true,
      email: true,
      name: true,
      city: true,
      country: true,
      address: true,
      postalCode: true,
      discoveryRadius: true,
      createdAt: true
    }
  });

  res.json({ user: updatedUser });
};

// ==================== PASSWORD MANAGEMENT ====================

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

  await sendEmail(
    user.email,
    'Password Reset Request',
    `
      <h2>Password Reset Request</h2>
      <p>Hi ${user.name},</p>
      <p>You requested to reset your password. Click the link below to reset it:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
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

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerified: false
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

  // Generate new verification token
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken }
  });

  // Send verification email
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
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken: token } = req.body;

  if (!token) {
    throw new BadRequestError('Refresh token is required');
  }

  const result = await refreshAccessToken(token);

  if (!result) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  res.json(result);
};

/**
 * Logout - revoke current token
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  if (req.token && req.user) {
    await revokeToken(req.token, req.user!.id, 'logout');
  }

  res.json({ message: 'Logged out successfully' });
};

/**
 * Logout from all devices - revoke all tokens
 */
export const logoutAll = async (req: Request, res: Response): Promise<void> => {
  if (req.user) {
    await revokeAllUserTokens(req.user!.id, 'logout_all');
  }

  res.json({ message: 'Logged out from all devices successfully' });
};

/**
 * Get active sessions for current user
 */
export const getSessions = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const sessions = await prisma.userSession.findMany({
    where: { 
      userId: req.user!.id,
      expiresAt: { gt: new Date() }
    },
    select: {
      id: true,
      deviceInfo: true,
      ipAddress: true,
      lastActive: true,
      createdAt: true,
      expiresAt: true
    },
    orderBy: { lastActive: 'desc' }
  });

  res.json({ sessions });
};

/**
 * Upload or update profile picture
 */

// Upload or update profile picture with history, soft delete, and audit fields
export const uploadProfilePicture = async (req: Request, res: Response): Promise<void> => {
  let tempFilePath: string | undefined;
  let finalFilePath: string | undefined;
  try {
    if (!req.user!?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    tempFilePath = req.file.path;
    const validation = await validateImage(tempFilePath);
    if (!validation.valid) {
      await deleteFile(tempFilePath);
      res.status(400).json({ error: validation.error });
      return;
    }
    const filename = generateUniqueFilename(req.file.originalname, 'profile_');
    finalFilePath = path.join(UPLOAD_CONFIG.UPLOAD_DIR.PROFILES, filename);
    await processImage(tempFilePath, finalFilePath, {
      width: UPLOAD_CONFIG.IMAGE.PROFILE_WIDTH,
      height: UPLOAD_CONFIG.IMAGE.PROFILE_HEIGHT,
      fit: 'cover',
      quality: UPLOAD_CONFIG.IMAGE.JPEG_QUALITY,
      format: 'jpeg',
    });
    await deleteFile(tempFilePath);
    tempFilePath = undefined;
    const pictureUrl = `/uploads/profiles/${filename}`;
    // Mark all previous pictures as not current
    await prisma.userProfilePicture.updateMany({
      where: { userId: req.user!.id, isCurrent: true, deletedAt: null },
      data: { isCurrent: false, updatedBy: req.user!.id, updatedAt: new Date() },
    });
    // Insert new picture record
    await prisma.userProfilePicture.create({
      data: {
        userId: req.user!.id,
        url: pictureUrl,
        isCurrent: true,
        createdBy: req.user!.id,
        updatedBy: req.user!.id,
      },
    });
    // Update User.profilePicture
    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { profilePicture: pictureUrl },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        city: true,
        country: true,
        address: true,
        postalCode: true,
        discoveryRadius: true,
        createdAt: true,
      },
    });
    logger.info('Profile picture uploaded (history/audit)', 'AuthController', { userId: req.user!.id });
    res.json({ user: updatedUser, message: 'Profile picture uploaded successfully' });
  } catch (error) {
    logger.error('Failed to upload profile picture', 'AuthController', { error });
    if (tempFilePath) await deleteFile(tempFilePath);
    if (finalFilePath) await deleteFile(finalFilePath);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
};

/**
 * Delete profile picture
 */

// Soft delete current profile picture, update User.profilePicture to previous (if any)
export const deleteProfilePicture = async (req: Request, res: Response): Promise<void> => {
  if (!req.user!?.id) {
    throw new UnauthorizedError('Unauthorized');
  }
  // Find current profile picture
  const currentPic = await prisma.userProfilePicture.findFirst({
    where: { userId: req.user!.id, isCurrent: true, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!currentPic) {
    throw new NotFoundError('No profile picture to delete');
  }
  // Soft delete current
  await prisma.userProfilePicture.update({
    where: { id: currentPic.id },
    data: { deletedAt: new Date(), isCurrent: false, updatedBy: req.user!.id, updatedAt: new Date() },
  });
  // Find previous (not deleted) picture
  const prevPic = await prisma.userProfilePicture.findFirst({
    where: { userId: req.user!.id, deletedAt: null, isCurrent: false },
    orderBy: { createdAt: 'desc' },
  });
  // Update User.profilePicture
  const updatedUser = await prisma.user.update({
    where: { id: req.user!.id },
    data: { profilePicture: prevPic ? prevPic.url : null },
    select: {
      id: true,
      email: true,
      name: true,
      profilePicture: true,
      city: true,
      country: true,
      address: true,
      postalCode: true,
      discoveryRadius: true,
      createdAt: true,
    },
  });
  logger.info('Profile picture soft-deleted (history/audit)', 'AuthController', { userId: req.user!.id });
  res.json({ user: updatedUser, message: 'Profile picture deleted successfully' });
};

// List all profile pictures (history, including soft-deleted)
export const listProfilePictures = async (req: Request, res: Response): Promise<void> => {
  if (!req.user!?.id) {
    throw new UnauthorizedError('Unauthorized');
  }
  const pictures = await prisma.userProfilePicture.findMany({
    where: { userId: req.user!.id },
    orderBy: [{ createdAt: 'desc' }],
  });
  res.json({ pictures });
};

// Restore a soft-deleted profile picture and set as current
export const restoreProfilePicture = async (req: Request, res: Response): Promise<void> => {
  if (!req.user!?.id) {
    throw new UnauthorizedError('Unauthorized');
  }
  const { pictureId } = req.body;
  // Find the picture
  const pic = await prisma.userProfilePicture.findFirst({
    where: { id: pictureId, userId: req.user!.id },
  });
  if (!pic || !pic.deletedAt) {
    throw new NotFoundError('Picture not found or not deleted');
  }
  // Mark all other as not current
  await prisma.userProfilePicture.updateMany({
    where: { userId: req.user!.id, isCurrent: true },
    data: { isCurrent: false, updatedBy: req.user!.id, updatedAt: new Date() },
  });
  // Restore this picture
  await prisma.userProfilePicture.update({
    where: { id: pictureId },
    data: { deletedAt: null, isCurrent: true, updatedBy: req.user!.id, updatedAt: new Date() },
  });
  // Update User.profilePicture
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { profilePicture: pic.url },
  });
  res.json({ message: 'Profile picture restored and set as current' });
};

// Permanently delete a profile picture (hard delete)
export const hardDeleteProfilePicture = async (req: Request, res: Response): Promise<void> => {
  if (!req.user!?.id) {
    throw new UnauthorizedError('Unauthorized');
  }
  const { pictureId } = req.body;
  const pic = await prisma.userProfilePicture.findFirst({
    where: { id: pictureId, userId: req.user!.id },
  });
  if (!pic) {
    throw new NotFoundError('Picture not found');
  }
  // Remove file from disk
  await deleteOldPicture(pic.url);
  // Delete from DB
  await prisma.userProfilePicture.delete({ where: { id: pictureId } });
  res.json({ message: 'Profile picture permanently deleted' });
};

/**
 * OAuth callback handler - generates tokens after successful OAuth authentication
 */
export const oauthCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication failed' });
      return;
    }

    const user = req.user!;

    // Generate token pair with session tracking
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip;
    const tokens = await generateTokenPair(user.id, deviceInfo, ipAddress);

    // Get the invite group ID from session if it exists
    const inviteGroupId = req.session?.inviteGroupId;
    
    // Clear the session data
    if (inviteGroupId && req.session) {
      delete req.session.inviteGroupId;
    }

    // Build redirect URL with tokens
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const redirectUrl = new URL('/auth/callback', frontendUrl);
    redirectUrl.searchParams.set('token', tokens.accessToken);
    redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
    
    if (inviteGroupId) {
      redirectUrl.searchParams.set('inviteGroupId', inviteGroupId);
    }

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('OAuth callback error', 'AuthController', { error });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
};

/**
 * Get OAuth account connection status
 */
export const getOAuthStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!?.id;
  
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleId: true,
      facebookId: true,
      authProvider: true,
      password: true,
      lastOAuthSync: true,
      oauthProfilePicture: true
    }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json({
    connections: {
      google: !!user.googleId,
      facebook: !!user.facebookId,
      local: !!user.password
    },
    primaryProvider: user.authProvider,
    lastOAuthSync: user.lastOAuthSync,
    hasOAuthProfilePicture: !!user.oauthProfilePicture
  });
};

/**
 * Unlink OAuth account
 */
export const unlinkOAuthAccount = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!?.id;
  const { provider } = req.body;

  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  if (!provider || !['google', 'facebook'].includes(provider)) {
    throw new BadRequestError('Invalid provider. Must be "google" or "facebook"');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleId: true,
      facebookId: true,
      password: true,
      authProvider: true
    }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Check if user has another authentication method
  const hasGoogle = !!user.googleId;
  const hasFacebook = !!user.facebookId;
  const hasPassword = !!user.password;

  if (provider === 'google' && hasGoogle && !hasFacebook && !hasPassword) {
    throw new BadRequestError('Cannot unlink Google account. You must have at least one authentication method. Please set a password first.');
  }

  if (provider === 'facebook' && hasFacebook && !hasGoogle && !hasPassword) {
    throw new BadRequestError('Cannot unlink Facebook account. You must have at least one authentication method. Please set a password first.');
  }

  // Unlink the account
  const updateData: Record<string, unknown> = {};
  if (provider === 'google') {
    updateData.googleId = null;
    // Update authProvider if Google was the primary
    if (user.authProvider === 'google') {
      if (hasFacebook) {
        updateData.authProvider = 'facebook';
      } else if (hasPassword) {
        updateData.authProvider = 'local';
      }
    }
  } else if (provider === 'facebook') {
    updateData.facebookId = null;
    // Update authProvider if Facebook was the primary
    if (user.authProvider === 'facebook') {
      if (hasGoogle) {
        updateData.authProvider = 'google';
      } else if (hasPassword) {
        updateData.authProvider = 'local';
      }
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData
  });

  logger.info(`${provider} account unlinked`, 'AuthController', { userId });
  res.json({ message: `${provider} account unlinked successfully` });
};

/**
 * Sync OAuth profile picture
 */
export const syncOAuthProfilePicture = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!?.id;

  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      oauthProfilePicture: true,
      profilePicture: true
    }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (!user.oauthProfilePicture) {
    throw new BadRequestError('No OAuth profile picture available');
  }

  // Update user's profile picture to OAuth picture
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { 
      profilePicture: user.oauthProfilePicture,
      lastOAuthSync: new Date()
    },
    select: {
      id: true,
      email: true,
      name: true,
      profilePicture: true,
      city: true,
      country: true,
      address: true,
      postalCode: true,
      discoveryRadius: true,
      createdAt: true
    }
  });

  logger.info('OAuth profile picture synced', 'AuthController', { userId });
  res.json({ user: updatedUser, message: 'Profile picture synced from OAuth provider' });
};

// ==================== DASHBOARD AGGREGATE ENDPOINT ====================

/**
 * Get dashboard summary data for the authenticated user.
 *
 * Returns a single aggregate payload that combines:
 *   - upcoming sessions the user is participating in (max 5)
 *   - the user's groups (max 5, most recently created first)
 *   - unread notification count
 *   - lightweight stats (totalSessions, upcomingCount, groupCount)
 *
 * This replaces the 2–3 separate API round-trips previously required by
 * the mobile dashboard page.
 *
 * GET /api/auth/me/dashboard
 */
export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const now = new Date();

  const [upcomingSessions, groups, notificationStats] = await Promise.all([
    // Top 5 upcoming sessions the user is a confirmed participant of
    prisma.session.findMany({
      where: {
        archived: false,
        startTime: { gte: now },
        participants: {
          some: {
            userId,
            status: 'confirmed',
          },
        },
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, profilePicture: true },
        },
        group: {
          select: { id: true, name: true },
        },
        _count: {
          select: { participants: true, guestParticipants: true, comments: true },
        },
      },
      orderBy: { startTime: 'asc' },
      take: 5,
    }),

    // User's groups (most recent first, max 5)
    prisma.group.findMany({
      where: {
        members: { some: { userId } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        isPublic: true,
        sportType: true,
        picture: true,
        city: true,
        createdAt: true,
        creatorId: true,
        _count: { select: { members: true, sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),

    // Unread notification count (all categories)
    prisma.$transaction([
      prisma.sessionNotification.count({ where: { userId, read: false } }),
      prisma.groupNotification.count({ where: { userId, read: false } }),
      prisma.teamUpNotification.count({ where: { userId, read: false } }),
      prisma.tournamentNotification.count({ where: { userId, read: false } }),
    ]),
  ]);

  const unreadNotifications =
    notificationStats[0] +
    notificationStats[1] +
    notificationStats[2] +
    notificationStats[3];

  // Total sessions the user has ever joined
  const totalSessions = await prisma.sessionParticipant.count({ where: { userId } });

  // Normalize group `picture` → `profilePicture` to match the shared mobile contract
  const recentGroups = groups.map(g => ({
    ...g,
    profilePicture: g.picture,
    picture: undefined,
  }));

  res.json({
    upcomingSessions,
    recentGroups,
    unreadNotifications,
    stats: {
      totalSessions,
      upcomingCount: upcomingSessions.length,
      groupCount: groups.length,
    },
  });
};
