import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ACCOUNT_LOCKOUT, PASSWORD_RESET } from '../config/security';
import { generateTokenPair, revokeToken, revokeAllUserTokens, refreshAccessToken } from '../utils/jwt';
import { validate2FAToken } from './twoFactorController';
import { logger } from '../utils/logger';
import { validateEmail, validateStrongPassword, isRequired, ValidationError, sanitizeString } from '../utils/validation';
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

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    // Validate and sanitize inputs
    try {
      isRequired(name, 'Name');
      validateEmail(email, 'Email');
      validateStrongPassword(password);
    } catch (validationError) {
      if (validationError instanceof ValidationError) {
        res.status(400).json({ error: validationError.message });
        return;
      }
      throw validationError;
    }

    // Sanitize string inputs
    const sanitizedEmail = sanitizeString(email).toLowerCase();
    const sanitizedName = sanitizeString(name);

    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail }
    });

    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        password: hashedPassword,
        name: sanitizedName,
        emailVerificationToken
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        emailVerified: true
      }
    });

    // Send verification email
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
  } catch (error) {
    logger.error('User registration failed', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to register user' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, twoFactorToken } = req.body;

    // Validate inputs
    try {
      validateEmail(email, 'Email');
      isRequired(password, 'Password');
    } catch (validationError) {
      if (validationError instanceof ValidationError) {
        res.status(400).json({ error: validationError.message });
        return;
      }
      throw validationError;
    }

    // Sanitize email
    const sanitizedEmail = sanitizeString(email).toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        twoFactorEnabled: true,
        failedLoginAttempts: true,
        accountLockedUntil: true
      }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const minutesRemaining = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({ 
        error: `Account temporarily locked due to too many failed login attempts. Please try again in ${minutesRemaining} minute(s).` 
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      // Increment failed login attempts
      const newFailedAttempts = user.failedLoginAttempts + 1;
      
      let updateData: { failedLoginAttempts: number; accountLockedUntil?: Date } = {
        failedLoginAttempts: newFailedAttempts
      };

      // Lock account after max attempts
      if (newFailedAttempts >= ACCOUNT_LOCKOUT.MAX_ATTEMPTS) {
        updateData.accountLockedUntil = new Date(Date.now() + ACCOUNT_LOCKOUT.LOCK_DURATION_MINUTES * 60000);
        logger.warn('Account locked due to failed login attempts', 'AuthController', { 
          userId: user.id, 
          email: sanitizedEmail 
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });

      res.status(401).json({ 
        error: newFailedAttempts >= ACCOUNT_LOCKOUT.MAX_ATTEMPTS 
          ? `Account locked for ${ACCOUNT_LOCKOUT.LOCK_DURATION_MINUTES} minutes due to too many failed attempts` 
          : 'Invalid credentials' 
      });
      return;
    }

    // Reset failed login attempts on successful password validation
    if (user.failedLoginAttempts > 0 || user.accountLockedUntil) {
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
        res.status(401).json({ error: validation.error || 'Invalid 2FA token' });
        return;
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
  } catch (error) {
    logger.error('User login failed', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    logger.error('Failed to get profile', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, city, country } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }

    // Check if email is already taken by another user
    if (email !== req.user!.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { 
        name, 
        email,
        city: city || null,
        country: country || null
      },
      select: {
        id: true,
        email: true,
        name: true,
        city: true,
        country: true,
        createdAt: true
      }
    });

    res.json({ user: updatedUser });
  } catch (error) {
    logger.error('Failed to update profile', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const updatePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    // Validate strong password
    try {
      validateStrongPassword(newPassword);
    } catch (validationError) {
      if (validationError instanceof ValidationError) {
        res.status(400).json({ error: validationError.message });
        return;
      }
      throw validationError;
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, password: true }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword }
    });

    // Revoke all existing tokens for security (except current one for convenience)
    await revokeAllUserTokens(req.user!.id, 'password_change');

    logger.info('Password changed', 'AuthController', { userId: req.user!.id });
    res.json({ message: 'Password updated successfully. You have been logged out from other devices for security.' });
  } catch (error) {
    logger.error('Failed to update password', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to update password' });
  }
};

/**
 * Request password reset - sends email with reset token
 */
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Validate input
    try {
      validateEmail(email, 'Email');
    } catch (validationError) {
      if (validationError instanceof ValidationError) {
        res.status(400).json({ error: validationError.message });
        return;
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
  } catch (error) {
    logger.error('Failed to request password reset', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

/**
 * Reset password with token
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    // Validate inputs
    try {
      isRequired(token, 'Reset token');
      validateStrongPassword(newPassword);
    } catch (validationError) {
      if (validationError instanceof ValidationError) {
        res.status(400).json({ error: validationError.message });
        return;
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
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
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
  } catch (error) {
    logger.error('Failed to reset password', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

/**
 * Verify email with token
 */
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Verification token is required' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerified: false
      }
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired verification token' });
      return;
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
  } catch (error) {
    logger.error('Failed to verify email', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to verify email' });
  }
};

/**
 * Resend email verification
 */
export const resendVerificationEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
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
      res.status(400).json({ error: 'Email is already verified' });
      return;
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
  } catch (error) {
    logger.error('Failed to resend verification email', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
};

/**
 * Refresh access token using refresh token
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const result = await refreshAccessToken(token);

    if (!result) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    res.json(result);
  } catch (error) {
    logger.error('Failed to refresh token', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

/**
 * Logout - revoke current token
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.token && req.user) {
      await revokeToken(req.token, req.user.id, 'logout');
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Failed to logout', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to logout' });
  }
};

/**
 * Logout from all devices - revoke all tokens
 */
export const logoutAll = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user) {
      await revokeAllUserTokens(req.user.id, 'logout_all');
    }

    res.json({ message: 'Logged out from all devices successfully' });
  } catch (error) {
    logger.error('Failed to logout from all devices', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to logout from all devices' });
  }
};

/**
 * Get active sessions for current user
 */
export const getSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const sessions = await prisma.userSession.findMany({
      where: { 
        userId: req.user.id,
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
  } catch (error) {
    logger.error('Failed to get sessions', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to get sessions' });
  }
};

/**
 * Upload or update profile picture
 */
export const uploadProfilePicture = async (req: Request, res: Response): Promise<void> => {
  let tempFilePath: string | undefined;
  let finalFilePath: string | undefined;

  try {
    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    tempFilePath = req.file.path;

    // Validate the image
    const validation = await validateImage(tempFilePath);
    if (!validation.valid) {
      await deleteFile(tempFilePath);
      res.status(400).json({ error: validation.error });
      return;
    }

    // Generate unique filename for the processed image
    const filename = generateUniqueFilename(req.file.originalname, 'profile_');
    finalFilePath = path.join(UPLOAD_CONFIG.UPLOAD_DIR.PROFILES, filename);

    // Process the image (resize, optimize, strip EXIF)
    await processImage(tempFilePath, finalFilePath, {
      width: UPLOAD_CONFIG.IMAGE.PROFILE_WIDTH,
      height: UPLOAD_CONFIG.IMAGE.PROFILE_HEIGHT,
      fit: 'cover',
      quality: UPLOAD_CONFIG.IMAGE.JPEG_QUALITY,
      format: 'jpeg',
    });

    // Delete temp file
    await deleteFile(tempFilePath);
    tempFilePath = undefined;

    // Get current user to check for existing profile picture
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { profilePicture: true },
    });

    // Delete old profile picture if it exists
    if (currentUser?.profilePicture) {
      await deleteOldPicture(currentUser.profilePicture);
    }

    // Generate the URL for the picture
    const pictureUrl = `/uploads/profiles/${filename}`;

    // Update user's profile picture in database
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
        createdAt: true,
      },
    });

    logger.info('Profile picture uploaded successfully', 'AuthController', { 
      userId: req.user!.id 
    });

    res.json({ 
      user: updatedUser,
      message: 'Profile picture uploaded successfully' 
    });
  } catch (error) {
    logger.error('Failed to upload profile picture', 'AuthController', { error });

    // Clean up files on error
    if (tempFilePath) {
      await deleteFile(tempFilePath);
    }
    if (finalFilePath) {
      await deleteFile(finalFilePath);
    }

    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
};

/**
 * Delete profile picture
 */
export const deleteProfilePicture = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get current user to check for existing profile picture
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { profilePicture: true },
    });

    if (!currentUser?.profilePicture) {
      res.status(404).json({ error: 'No profile picture to delete' });
      return;
    }

    // Delete the file
    await deleteOldPicture(currentUser.profilePicture);

    // Update user's profile picture in database
    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { profilePicture: null },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        city: true,
        country: true,
        createdAt: true,
      },
    });

    logger.info('Profile picture deleted successfully', 'AuthController', { 
      userId: req.user!.id 
    });

    res.json({ 
      user: updatedUser,
      message: 'Profile picture deleted successfully' 
    });
  } catch (error) {
    logger.error('Failed to delete profile picture', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to delete profile picture' });
  }
};
