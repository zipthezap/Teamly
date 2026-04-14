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
import { generateTokenPair, revokeToken, revokeAllUserTokens, refreshAccessToken } from '../utils/jwt';
import { validate2FAToken } from './twoFactorController';
import { validateEmail, isRequired, ValidationError, sanitizeString } from '../utils/validation';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { sendEmail } from '../utils/emailService';
import * as authService from '../services/authService';

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
