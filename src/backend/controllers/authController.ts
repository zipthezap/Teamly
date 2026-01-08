import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ACCOUNT_LOCKOUT, PASSWORD_RESET } from '../config/security';
import { generateToken } from '../utils/jwt';
import { validate2FAToken } from './twoFactorController';
import { logger } from '../utils/logger';
import { validateEmail, validateStrongPassword, isRequired, ValidationError, sanitizeString } from '../utils/validation';

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

    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        password: hashedPassword,
        name: sanitizedName
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    const token = generateToken(user.id);

    res.status(201).json({ user, token });
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

    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
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

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
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

    res.json({ message: 'Password updated successfully' });
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
    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    logger.error('Failed to reset password', 'AuthController', { error });
    res.status(500).json({ error: 'Failed to reset password' });
  }
};
