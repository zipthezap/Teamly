/**
 * Mock User Data
 * Centralized mock data for user testing
 */

export const mockUser = {
  id: 'user-1',
  email: 'john@example.com',
  name: 'John Doe',
  password: 'hashedPassword123',
  city: 'New York',
  country: 'USA',
  discoveryRadius: 50,
  notificationPreferences: {
    email: true,
    push: true,
    eventReminders: true,
    groupInvites: true,
  },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

export const mockUserWithProfile = {
  ...mockUser,
  bio: 'Soccer enthusiast',
  profilePicture: 'https://example.com/profile.jpg',
  phoneNumber: '+1234567890',
};

export const mockUsers = [
  mockUser,
  {
    id: 'user-2',
    email: 'jane@example.com',
    name: 'Jane Smith',
    password: 'hashedPassword456',
    city: 'New York',
    country: 'USA',
    discoveryRadius: 75,
    notificationPreferences: {
      email: true,
      push: false,
      eventReminders: true,
      groupInvites: false,
    },
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  },
  {
    id: 'user-3',
    email: 'bob@example.com',
    name: 'Bob Johnson',
    password: 'hashedPassword789',
    city: 'Boston',
    country: 'USA',
    discoveryRadius: 100,
    notificationPreferences: {
      email: false,
      push: true,
      eventReminders: false,
      groupInvites: true,
    },
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  },
];

export const mockUsersWithDetails = mockUsers.map(user => ({
  ...user,
  bio: `${user.name}'s bio`,
  profilePicture: `https://example.com/${user.id}.jpg`,
}));

export const mockUsersByCity = {
  'New York': [mockUsers[0], mockUsers[1]],
  'Boston': [mockUsers[2]],
};

export const mockUsersWithNotificationPrefs = mockUsers.filter(
  user => user.notificationPreferences.email
);

export const mockAdmin = {
  ...mockUser,
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
};

export const mockModerator = {
  ...mockUser,
  id: 'mod-1',
  email: 'mod@example.com',
  name: 'Moderator User',
  role: 'moderator',
};
