import prisma from '../config/database';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

// Setup 2FA - Generate secret and QR code
export const setup2FA = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;

  // Check if 2FA is already enabled
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, email: true, name: true }
  });

  if (user.twoFactorEnabled) {
    throw new BadRequestError('2FA is already enabled');
  }

  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `Teamly (${user.email})`,
    issuer: 'Teamly'
  });

  // Generate backup codes (10 codes)
  const backupCodes = [];
  for (let i = 0; i < 10; i++) {
    backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }

  // Store secret temporarily (not yet enabled)
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret.base32,
      twoFactorBackupCodes: backupCodes
    }
  });

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  res.json({
    secret: secret.base32,
    qrCode: qrCodeUrl,
    backupCodes: backupCodes
  });
});

// Verify and enable 2FA
export const verify2FA = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { token } = req.body;

  if (!token) {
    throw new BadRequestError('Token is required');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true }
  });

  if (user.twoFactorEnabled) {
    throw new BadRequestError('2FA is already enabled');
  }

  if (!user.twoFactorSecret) {
    throw new BadRequestError('2FA not set up. Please call setup endpoint first');
  }

  // Verify the token
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token: token,
    window: 2 // Allow 2 time steps before/after for clock drift
  });

  if (!verified) {
    throw new BadRequestError('Invalid token');
  }

  // Enable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true }
  });

  res.json({ message: '2FA enabled successfully' });
});

// Disable 2FA
export const disable2FA = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { password } = req.body;

  if (!password) {
    throw new BadRequestError('Password is required to disable 2FA');
  }

  // Verify password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, twoFactorEnabled: true }
  });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    throw new UnauthorizedError('Invalid password');
  }

  if (!user.twoFactorEnabled) {
    throw new BadRequestError('2FA is not enabled');
  }

  // Disable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: []
    }
  });

  res.json({ message: '2FA disabled successfully' });
});

// Validate 2FA token during login
export const validate2FAToken = async (userId: string, token: string): Promise<any> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorBackupCodes: true }
    });

    if (!user.twoFactorSecret) {
      return { valid: false, error: '2FA not configured' };
    }

    // Check if it's a backup code
    if (user.twoFactorBackupCodes.includes(token.toUpperCase())) {
      // Remove the used backup code
      const updatedCodes = user.twoFactorBackupCodes.filter(
        code => code !== token.toUpperCase()
      );
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: updatedCodes }
      });
      return { valid: true, usedBackupCode: true };
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    return { valid: verified };
  } catch (error) {
    logger.error('Validate 2FA token error:', 'twoFactorControllerController', { error });
    return { valid: false, error: 'Validation failed' };
  }
};

// Get 2FA status
export const get2FAStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      twoFactorEnabled: true,
      twoFactorBackupCodes: true
    }
  });

  res.json({
    enabled: user.twoFactorEnabled,
    backupCodesRemaining: user.twoFactorBackupCodes.length
  });
});

