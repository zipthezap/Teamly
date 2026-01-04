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
const prisma = require('../config/database');

const createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const group = await prisma.group.create({
      data: {
        name,
        description,
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
    const { name, description } = req.body;

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
        ...(description !== undefined && { description })
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

module.exports = {
  createGroup,
  getGroups,
  getGroup,
  updateGroup,
  inviteMember,
  removeMember
  joinGroupByInvite,
};
