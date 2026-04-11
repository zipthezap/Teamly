/**
 * Mock Group Data
 * Centralized mock data for group testing
 */

export const mockGroup = {
  id: 'group-1',
  name: 'Soccer Enthusiasts',
  description: 'A group for soccer lovers',
  locationName: 'New York',
  city: 'New York',
  country: 'USA',
  latitude: 40.7128,
  longitude: -74.0060,
  maxMembers: 100,
  isPublic: true,
  tags: 'soccer, sports',
  creatorId: 'user-1',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

export const mockGroupWithMembers = {
  ...mockGroup,
  members: [
    {
      id: 'member-1',
      userId: 'user-1',
      groupId: 'group-1',
      role: 'admin',
      joinedAt: new Date('2024-01-01T00:00:00Z'),
    },
    {
      id: 'member-2',
      userId: 'user-2',
      groupId: 'group-1',
      role: 'member',
      joinedAt: new Date('2024-01-02T00:00:00Z'),
    },
    {
      id: 'member-3',
      userId: 'user-3',
      groupId: 'group-1',
      role: 'moderator',
      joinedAt: new Date('2024-01-03T00:00:00Z'),
    },
  ],
};

export const mockGroupWithEvents = {
  ...mockGroupWithMembers,
  events: [
    {
      id: 'session-1',
      title: 'Soccer Match',
      startTime: new Date('2024-02-01T10:00:00Z'),
      archived: false,
    },
    {
      id: 'session-2',
      title: 'Practice Session',
      startTime: new Date('2024-02-08T10:00:00Z'),
      archived: false,
    },
  ],
};

export const mockPrivateGroup = {
  ...mockGroup,
  id: 'group-2',
  name: 'Private Tennis Club',
  isPublic: false,
};

export const mockGroupMember = {
  id: 'member-1',
  userId: 'user-1',
  groupId: 'group-1',
  role: 'admin',
  joinedAt: new Date('2024-01-01T00:00:00Z'),
};

export const mockGroupMembers = [
  mockGroupMember,
  {
    id: 'member-2',
    userId: 'user-2',
    groupId: 'group-1',
    role: 'member',
    joinedAt: new Date('2024-01-02T00:00:00Z'),
  },
  {
    id: 'member-3',
    userId: 'user-3',
    groupId: 'group-1',
    role: 'moderator',
    joinedAt: new Date('2024-01-03T00:00:00Z'),
  },
];

export const mockGroupAdmins = [
  mockGroupMember,
  {
    id: 'member-4',
    userId: 'user-4',
    groupId: 'group-1',
    role: 'admin',
    joinedAt: new Date('2024-01-04T00:00:00Z'),
  },
];

export const mockJoinRequest = {
  id: 'request-1',
  userId: 'user-5',
  groupId: 'group-1',
  status: 'pending',
  createdAt: new Date('2024-01-10T00:00:00Z'),
};

export const mockGroupInvitation = {
  id: 'invitation-1',
  userId: 'user-6',
  groupId: 'group-1',
  invitedBy: 'user-1',
  status: 'pending',
  createdAt: new Date('2024-01-11T00:00:00Z'),
};

export const mockGroups = [
  mockGroup,
  mockPrivateGroup,
  {
    ...mockGroup,
    id: 'group-3',
    name: 'Basketball League',
    tags: 'basketball, sports',
  },
];
