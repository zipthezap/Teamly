import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { Request, Response } from 'express';
import path from 'path';
import {
  validateImage,
  processImage,
  deleteFile,
  deleteOldPicture,
  generateUniqueFilename
} from '../../utils/imageProcessor';
import { UPLOAD_CONFIG } from '../../config/upload';
import { CacheService } from '../../services/cacheService';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors';

/**
 * Upload or update group picture
 */
export const uploadGroupPicture = async (req: Request, res: Response) => {
  let tempFilePath: string | undefined;
  let finalFilePath: string | undefined;

  try {
    const { id } = req.params;

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user!.id,
        role: 'admin'
      }
    });

    if (!membership) {
      throw new ForbiddenError('Only group admins can update group picture');
    }

    // Check if file was uploaded
    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    tempFilePath = req.file.path;

    // Validate the image
    const validation = await validateImage(tempFilePath);
    if (!validation.valid) {
      await deleteFile(tempFilePath);
      throw new BadRequestError(validation.error || 'Invalid image file');
    }

    // Verify group exists before processing
    const groupExists = await prisma.group.findUnique({
      where: { id },
      select: { id: true, picture: true },
    });

    if (!groupExists) {
      await deleteFile(tempFilePath);
      throw new NotFoundError('Group not found');
    }

    // Generate unique filename for the processed image
    const filename = generateUniqueFilename(req.file.originalname, 'group_');
    finalFilePath = path.join(UPLOAD_CONFIG.UPLOAD_DIR.GROUPS, filename);

    // Process the image (resize, optimize, strip EXIF)
    await processImage(tempFilePath, finalFilePath, {
      width: UPLOAD_CONFIG.IMAGE.GROUP_WIDTH,
      height: UPLOAD_CONFIG.IMAGE.GROUP_HEIGHT,
      fit: 'cover',
      quality: UPLOAD_CONFIG.IMAGE.JPEG_QUALITY,
      format: 'jpeg',
    });

    // Delete temp file
    await deleteFile(tempFilePath);
    tempFilePath = undefined;

    // Delete old picture if it exists
    if (groupExists.picture) {
      await deleteOldPicture(groupExists.picture);
    }

    // Generate the URL for the picture
    const pictureUrl = `/uploads/groups/${filename}`;

    // Update group's picture in database
    const updatedGroup = await prisma.group.update({
      where: { id },
      data: { picture: pictureUrl },
      include: {
        creator: {
          select: { id: true, name: true, email: true, profilePicture: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, profilePicture: true }
            }
          }
        }
      }
    });

    logger.debug('Group picture uploaded successfully', 'GroupController', { 
      groupId: id,
      userId: req.user!.id 
    });

    // Invalidate group cache for all affected users
    await Promise.allSettled([
      CacheService.invalidate('group', id),
      ...updatedGroup.members.map(member => 
        CacheService.deletePattern(`user:${member.userId}:groups:*`)
      )
    ]);

    res.json({ 
      group: updatedGroup,
      message: 'Group picture uploaded successfully' 
    });
  } catch (error) {
    logger.error('Failed to upload group picture', 'GroupController', { error });

    // Clean up files on error
    if (tempFilePath) {
      await deleteFile(tempFilePath);
    }
    if (finalFilePath) {
      await deleteFile(finalFilePath);
    }

    // Re-throw the error so asyncHandler can handle it properly
    throw error;
  }
};

/**
 * Delete group picture
 */
export const deleteGroupPicture = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is admin of the group
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: id,
      userId: req.user!.id,
      role: 'admin'
    }
  });

  if (!membership) {
    throw new ForbiddenError('Only group admins can delete group picture');
  }

  // Get current group to check for existing picture
  const currentGroup = await prisma.group.findUnique({
    where: { id },
    select: { picture: true },
  });

  if (!currentGroup?.picture) {
    throw new NotFoundError('No group picture to delete');
  }

  // Delete the file
  await deleteOldPicture(currentGroup.picture);

  // Update group's picture in database
  const updatedGroup = await prisma.group.update({
    where: { id },
    data: { picture: null },
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true }
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, profilePicture: true }
          }
        }
      }
    }
  });

  logger.debug('Group picture deleted successfully', 'GroupController', { 
    groupId: id,
    userId: req.user!.id 
  });

  // Invalidate group cache for all affected users
  await Promise.allSettled([
    CacheService.invalidate('group', id),
    ...updatedGroup.members.map(member => 
      CacheService.deletePattern(`user:${member.userId}:groups:*`)
    )
  ]);

  res.json({ 
    group: updatedGroup,
    message: 'Group picture deleted successfully' 
  });
};
