// Delete a group (admin only)
export const deleteGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user.id,
        role: 'admin'
      }
    });
    if (!membership) {
      return res.status(403).json({ error: 'Only admins can delete the group' });
    }
    // Delete group and cascade related data (members, events, etc.)
    await prisma.group.delete({
      where: { id },
    });
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete group', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to delete group' });
  }
};
import prisma from '../config/database';
import { sendEmail } from '../utils/emailService';
import { shouldSendEmailNotification } from '../utils/notificationHelper';
import { logger } from '../utils/logger';
import { sanitizeString } from '../utils/validation';
import { Request, Response } from 'express';
import path from 'path';
import { 
  validateImage, 
  processImage, 
  deleteFile, 
  deleteOldPicture,
  generateUniqueFilename 
} from '../utils/imageProcessor';
import { UPLOAD_CONFIG } from '../config/upload';


export const createGroup = async (req: Request, res: Response) => {
  try {
    const { name, description, isPublic, latitude, longitude, locationName, city, country } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    // Sanitize text inputs
    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = description ? sanitizeString(description) : null;
    const sanitizedLocationName = locationName ? sanitizeString(locationName) : null;
    const sanitizedCity = city ? sanitizeString(city) : null;
    const sanitizedCountry = country ? sanitizeString(country) : null;

    const group = await prisma.group.create({
      data: {
        name: sanitizedName,
        description: sanitizedDescription,
        isPublic: isPublic || false,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        locationName: sanitizedLocationName,
        city: sanitizedCity,
        country: sanitizedCountry,
        creatorId: req.user.id,
        members: {
          create: {
            userId: req.user.id,
            role: 'admin'
          }
        }
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    // Notify users nearby (within 10km) except creator
    if (latitude && longitude) {
      // Future feature: Find nearby users and notify them
      // const R = 6371; // km
      // const toRad = deg => deg * Math.PI / 180;
      const users = await prisma.user.findMany({
        where: {
          id: { not: req.user.id }
        },
        select: { id: true }
      });
      // Calculate which users are nearby - unused for now but kept for future feature
      // const isNearby = (lat1, lon1, lat2, lon2) => {
      //   const dLat = toRad(lat2 - lat1);
      //   const dLon = toRad(lon2 - lon1);
      //   const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      //             Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      //             Math.sin(dLon/2) * Math.sin(dLon/2);
      //   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      //   return R * c < 10; // 10km
      // };
      const nearbyUserIds = users.map(u => u.id);
      await Promise.all(nearbyUserIds.map(userId =>
        prisma.groupNotification.create({
          data: {
            groupId: group.id,
            userId,
            type: 'nearby_created',
            params: {
              groupName: group.name,
              name: req.user.name
            }
          }
        })
      ));
    }
    res.status(201).json(group);
  } catch (error) {
    logger.error('Failed to create group', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to create group' });
  }
};

export const getGroups = async (req: Request, res: Response) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userId: req.user.id
          }
        }
      },
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
        },
        events: {
          orderBy: { startTime: 'asc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Map each group to flatten member user fields
    const mappedGroups = groups.map((group: any) => ({
      ...group,
      members: group.members.map((member: any) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        profilePicture: member.user.profilePicture,
        role: member.role,
        // add other member fields if needed
      }))
    }));

    res.json(mappedGroups);
  } catch (error) {
    logger.error('Failed to get groups', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to get groups' });
  }
};

export const getGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findFirst({
      where: {
        id,
        members: {
          some: {
            userId: req.user.id
          }
        }
      },
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
        },
        events: {
          include: {
            creator: {
              select: { id: true, name: true, email: true }
            },
            participants: true
          },
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Map members to flatten user fields
    const mappedGroup = {
      ...group,
      members: group.members.map((member: any) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        profilePicture: member.user.profilePicture,
        role: member.role,
        // add other member fields if needed
      }))
    };

    res.json(mappedGroup);
  } catch (error) {
    logger.error('Failed to get group', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to get group' });
  }
};

export const updateGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isPublic, latitude, longitude, locationName, city, country } = req.body;

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user.id,
        role: 'admin'
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can update the group' });
    }

    const group = await prisma.group.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(locationName !== undefined && { locationName }),
        ...(city !== undefined && { city }),
        ...(country !== undefined && { country })
      },
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

    res.json(group);
  } catch (error) {
    logger.error('Failed to update group', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to update group' });
  }
};

export const inviteMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user is member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user.id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can invite others' });
    }

    // Get group info
    const group = await prisma.group.findUnique({
      where: { id }
    });

    // Find user to invite
    const userToInvite = await prisma.user.findUnique({
      where: { email }
    });

    if (!userToInvite) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already a member
    const existingMembership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: userToInvite.id
      }
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    const newMember = await prisma.groupMember.create({
      data: {
        groupId: id,
        userId: userToInvite.id,
        role: 'member'
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Send email notification
    const inviterUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    const shouldSend = await shouldSendEmailNotification(userToInvite.id, 'groupInvites');

    if (shouldSend) {
      await sendEmail(
        userToInvite.email,
        'groupInvitation',
        userToInvite.name,
        group.name,
        inviterUser.name
      );
    }

    res.status(201).json(newMember);
  } catch (error) {
    logger.error('Failed to invite member', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to invite member' });
  }
};

export const removeMember = async (req: Request, res: Response) => {
  try {
    const { id, memberId } = req.params;

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user.id,
        role: 'admin'
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    await prisma.groupMember.delete({
      where: { id: memberId }
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    logger.error('Failed to remove member', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

// Assign or update group member role (admin only)
export const updateMemberRole = async (req: Request, res: Response) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body;

    // Validate role with explicit type check
    const validRoles = ['admin', 'member'] as const;
    if (!role || !validRoles.includes(role as typeof validRoles[number])) {
      return res.status(400).json({ error: 'Invalid role. Must be "admin" or "member"' });
    }

    // Use a transaction to prevent race conditions when demoting admins
    const result = await prisma.$transaction(async (tx) => {
      // Check if user is admin of the group
      const adminMembership = await tx.groupMember.findFirst({
        where: {
          groupId: id,
          userId: req.user.id,
          role: 'admin'
        }
      });

      if (!adminMembership) {
        throw new Error('FORBIDDEN');
      }

      // Get the member to update with groupId constraint
      const memberToUpdate = await tx.groupMember.findFirst({
        where: {
          id: memberId,
          groupId: id
        }
      });

      if (!memberToUpdate) {
        throw new Error('NOT_FOUND');
      }

      // Check if trying to demote the last admin
      if (memberToUpdate.role === 'admin' && role === 'member') {
        const adminCount = await tx.groupMember.count({
          where: {
            groupId: id,
            role: 'admin'
          }
        });

        if (adminCount <= 1) {
          throw new Error('LAST_ADMIN');
        }
      }

      // Update the member role
      const updatedMember = await tx.groupMember.update({
        where: { id: memberId },
        data: { role },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      return updatedMember;
    });

    res.json(result);
  } catch (error: any) {
    logger.error('Failed to update member role', 'GroupController', { error });
    
    if (error.message === 'FORBIDDEN') {
      return res.status(403).json({ error: 'Only admins can update member roles' });
    }
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Member not found in this group' });
    }
    if (error.message === 'LAST_ADMIN') {
      return res.status(400).json({ error: 'Cannot demote the last admin. Please assign another admin first.' });
    }
    
    res.status(500).json({ error: 'Failed to update member role' });
  }
};

// Get all public groups (for discovery)
export const getPublicGroups = async (_req: Request, res: Response) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        isPublic: true
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, profilePicture: true }
        },
        _count: {
          select: { members: true, events: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(groups);
  } catch (error) {
    logger.error('Failed to get public groups', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to get public groups' });
  }
};

// Request to join a public group
export const requestJoinGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if group exists and is public
    const group = await prisma.group.findUnique({
      where: { id }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.isPublic) {
      return res.status(403).json({ error: 'Group is not public' });
    }

    // Check if already a member
    const existingMembership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user.id
      }
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Check if already has a pending request
    const existingRequest = await prisma.groupJoinRequest.findFirst({
      where: {
        groupId: id,
        userId: req.user.id,
        status: 'pending'
      }
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Join request already pending' });
    }

    // Create join request
    const joinRequest = await prisma.groupJoinRequest.create({
      data: {
        groupId: id,
        userId: req.user.id,
        status: 'pending'
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        group: {
          select: { id: true, name: true, description: true }
        }
      }
    });

    // Notify all group admins
    const admins = await prisma.groupMember.findMany({
      where: { groupId: id, role: 'admin' },
      select: { userId: true }
    });
    await Promise.all(admins.map(admin =>
      prisma.groupNotification.create({
        data: {
          groupId: id,
          userId: admin.userId,
          type: 'join_request',
          params: {
            groupName: joinRequest.group.name,
            name: req.user.name
          }
        }
      })
    ));

    res.status(201).json(joinRequest);
  } catch (error) {
    logger.error('Failed to request join group', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to request join group' });
  }
};

// Get join requests for a group (admin only)
export const getJoinRequests = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user.id,
        role: 'admin'
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can view join requests' });
    }

    const joinRequests = await prisma.groupJoinRequest.findMany({
      where: {
        groupId: id,
        status: 'pending'
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(joinRequests);
  } catch (error) {
    logger.error('Failed to get join requests', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to get join requests' });
  }
};

// Approve or reject a join request (admin only)
export const handleJoinRequest = async (req: Request, res: Response) => {
  try {
    const { id, requestId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
    }

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user.id,
        role: 'admin'
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can handle join requests' });
    }

    // Get the join request
    const joinRequest = await prisma.groupJoinRequest.findUnique({
      where: { id: requestId }
    });

    if (!joinRequest) {
      return res.status(404).json({ error: 'Join request not found' });
    }

    if (joinRequest.groupId !== id) {
      return res.status(400).json({ error: 'Join request does not belong to this group' });
    }

    if (joinRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Join request already processed' });
    }

    // Update the join request status
    const updatedRequest = await prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: action === 'approve' ? 'approved' : 'rejected' }
    });

    // If approved, add the user as a member
    if (action === 'approve') {
      await prisma.groupMember.create({
        data: {
          groupId: id,
          userId: joinRequest.userId,
          role: 'member'
        }
      });

      // Get group name for notification
      const groupInfo = await prisma.group.findUnique({
        where: { id },
        select: { name: true }
      });

      // Create notification for the user who was accepted
      if (groupInfo) {
        await prisma.groupNotification.create({
          data: {
            groupId: id,
            userId: joinRequest.userId,
            type: 'accepted',
            params: {
              groupName: groupInfo.name,
              name: req.user.name
            }
          }
        });
      }
    }

    res.json({ 
      message: `Join request ${action}d successfully`,
      request: updatedRequest
    });
  } catch (error) {
    logger.error('Failed to handle join request', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to handle join request' });
  }
};

// Join group by invite (public, for invite link)
export const joinGroupByInvite = async (req: Request, res: Response) => {
  try {
    const { userId, groupId } = req.body;
    if (!userId || !groupId) {
      return res.status(400).json({ error: 'userId and groupId are required' });
    }
    // Check if already a member
    const existing = await prisma.groupMember.findFirst({ where: { userId, groupId } });
    if (existing) {
      return res.status(200).json({ message: 'Already a member' });
    }
    await prisma.groupMember.create({
      data: { userId, groupId, role: 'member' }
    });
    res.status(201).json({ message: 'Joined group successfully' });
  } catch (error) {
    logger.error('Failed to join group by invite', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to join group' });
  }
};

// Leave a group
export const leaveGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the membership
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: userId
      }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Not a member of this group' });
    }

    // Check if user is the creator/admin and the only admin
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          where: { role: 'admin' }
        }
      }
    });

    if (membership.role === 'admin' && group.members.length === 1 && group.members[0].userId === userId) {
      return res.status(400).json({ error: 'Cannot leave group as the only admin. Please assign another admin first or delete the group.' });
    }

    // Delete the membership
    await prisma.groupMember.delete({
      where: { id: membership.id }
    });

    res.json({ message: 'Left group successfully' });
  } catch (error) {
    logger.error('Failed to leave group', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to leave group' });
  }
};

// Get invite link for a group
export const getInviteLink = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user is a member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user.id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can get invite links' });
    }

    // Return the group ID which can be used to construct the invite link on the frontend
    res.json({ groupId: id });
  } catch (error) {
    logger.error('Failed to get invite link', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to get invite link' });
  }
};

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
        userId: req.user.id,
        role: 'admin'
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group admins can update group picture' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempFilePath = req.file.path;

    // Validate the image
    const validation = await validateImage(tempFilePath);
    if (!validation.valid) {
      await deleteFile(tempFilePath);
      return res.status(400).json({ error: validation.error });
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

    // Get current group to check for existing picture
    const currentGroup = await prisma.group.findUnique({
      where: { id },
      select: { picture: true },
    });

    // Delete old picture if it exists
    if (currentGroup?.picture) {
      await deleteOldPicture(currentGroup.picture);
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

    logger.info('Group picture uploaded successfully', 'GroupController', { 
      groupId: id,
      userId: req.user.id 
    });

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

    res.status(500).json({ error: 'Failed to upload group picture' });
  }
};

/**
 * Delete group picture
 */
export const deleteGroupPicture = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user.id,
        role: 'admin'
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group admins can delete group picture' });
    }

    // Get current group to check for existing picture
    const currentGroup = await prisma.group.findUnique({
      where: { id },
      select: { picture: true },
    });

    if (!currentGroup?.picture) {
      return res.status(404).json({ error: 'No group picture to delete' });
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

    logger.info('Group picture deleted successfully', 'GroupController', { 
      groupId: id,
      userId: req.user.id 
    });

    res.json({ 
      group: updatedGroup,
      message: 'Group picture deleted successfully' 
    });
  } catch (error) {
    logger.error('Failed to delete group picture', 'GroupController', { error });
    res.status(500).json({ error: 'Failed to delete group picture' });
  }
};

