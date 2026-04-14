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

import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import path from 'path';
import { validateImage, processImage, deleteFile, deleteOldPicture, generateUniqueFilename } from '../utils/imageProcessor';
import { UPLOAD_CONFIG } from '../config/upload';

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
