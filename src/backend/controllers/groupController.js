const prisma = require('../config/database');
const { sendEmail } = require('../utils/emailService');
const { shouldSendEmailNotification } = require('../utils/notificationHelper');

const createGroup = async (req, res) => {
  try {
    const { name, description, isPublic, latitude, longitude, locationName } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const group = await prisma.group.create({
      data: {
        name,
        description,
        isPublic: isPublic || false,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        locationName,
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

    res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
};

const getGroups = async (req, res) => {
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
          select: { id: true, name: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
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

    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to get groups' });
  }
};

const getGroup = async (req, res) => {
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
          select: { id: true, name: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
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

    res.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to get group' });
  }
};

const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isPublic, latitude, longitude, locationName } = req.body;

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
        ...(locationName !== undefined && { locationName })
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

    res.json(group);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
};

const inviteMember = async (req, res) => {
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
    console.error('Invite member error:', error);
    res.status(500).json({ error: 'Failed to invite member' });
  }
};

const removeMember = async (req, res) => {
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
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

// Get all public groups (for discovery)
const getPublicGroups = async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        isPublic: true
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { members: true, events: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(groups);
  } catch (error) {
    console.error('Get public groups error:', error);
    res.status(500).json({ error: 'Failed to get public groups' });
  }
};

// Request to join a public group
const requestJoinGroup = async (req, res) => {
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

    res.status(201).json(joinRequest);
  } catch (error) {
    console.error('Request join group error:', error);
    res.status(500).json({ error: 'Failed to request join group' });
  }
};

// Get join requests for a group (admin only)
const getJoinRequests = async (req, res) => {
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
    console.error('Get join requests error:', error);
    res.status(500).json({ error: 'Failed to get join requests' });
  }
};

// Approve or reject a join request (admin only)
const handleJoinRequest = async (req, res) => {
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
    }

    res.json({ 
      message: `Join request ${action}d successfully`,
      request: updatedRequest
    });
  } catch (error) {
    console.error('Handle join request error:', error);
    res.status(500).json({ error: 'Failed to handle join request' });
  }
};

// Join group by invite (public, for invite link)
const joinGroupByInvite = async (req, res) => {
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
    console.error('Join group by invite error:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
};

// Leave a group
const leaveGroup = async (req, res) => {
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
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
};

// Get invite link for a group
const getInviteLink = async (req, res) => {
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
    console.error('Get invite link error:', error);
    res.status(500).json({ error: 'Failed to get invite link' });
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroup,
  updateGroup,
  inviteMember,
  removeMember,
  leaveGroup,
  getInviteLink,
  joinGroupByInvite,
  getPublicGroups,
  requestJoinGroup,
  getJoinRequests,
  handleJoinRequest,
};
