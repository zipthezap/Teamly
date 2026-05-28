// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Please set it in your .env file.\n' +
    'Example: DATABASE_URL="postgresql://user:password@localhost:5432/teamly?schema=public"'
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const bcrypt = require('bcryptjs');

async function validateTournamentSeedIntegrity(tournamentIds) {
  const tournaments = await prisma.tournament.findMany({
    where: { id: { in: tournamentIds } },
    select: {
      id: true,
      name: true,
      organizerId: true,
      categories: { select: { id: true } },
      adminRoles: { select: { userId: true } },
      teams: {
        select: {
          id: true,
          poolId: true,
          pool: { select: { categoryId: true } },
          captainUserId: true,
          players: { select: { userId: true } },
        },
      },
    },
  });

  for (const tournament of tournaments) {
    if (tournament.categories.length === 0) {
      throw new Error(`Seed integrity failed: "${tournament.name}" has no categories.`);
    }

    const restrictedUsers = new Set([
      tournament.organizerId,
      ...tournament.adminRoles.map((role) => role.userId),
    ]);

    const invalidCaptain = tournament.teams.find(
      (team) => team.captainUserId && restrictedUsers.has(team.captainUserId)
    );
    if (invalidCaptain) {
      throw new Error(
        `Seed integrity failed: organizer/admin is captain in "${tournament.name}" (team ${invalidCaptain.id}).`
      );
    }

    const invalidPlayer = tournament.teams.find((team) =>
      team.players.some((player) => player.userId && restrictedUsers.has(player.userId))
    );
    if (invalidPlayer) {
      throw new Error(
        `Seed integrity failed: organizer/admin is player in "${tournament.name}" (team ${invalidPlayer.id}).`
      );
    }

    const uncategorizedTeams = tournament.teams.filter(
      (team) => !team.poolId || !team.pool?.categoryId
    );
    if (uncategorizedTeams.length > 0) {
      throw new Error(
        `Seed integrity failed: ${uncategorizedTeams.length} team(s) in "${tournament.name}" are not assigned to a categorized pool.`
      );
    }
  }
}

async function main() {
  // Check if seeding is needed (skip if Alice exists)
  const existingAlice = await prisma.user.findUnique({ where: { email: 'alice@example.com' } });
  if (existingAlice) {
    console.log('Seed data already exists. Skipping seeding.');
    return;
  }

  // Hash the password for both users
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create two initial users
  const user1 = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      password: hashedPassword, // In production, hash passwords!
      name: 'Alice',
      emailVerified: true,
    },
  });
  const user2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      password: hashedPassword,
      name: 'Bob',
      emailVerified: true,
    },
  });
  const user3 = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
      email: 'charlie@example.com',
      password: hashedPassword,
      name: 'Charlie',
      emailVerified: true,
    },
  });
  const user4 = await prisma.user.upsert({
    where: { email: 'diana@example.com' },
    update: {},
    create: {
      email: 'diana@example.com',
      password: hashedPassword,
      name: 'Diana',
      emailVerified: true,
    },
  });
  console.log('Seeded users:', user1.email, user2.email, user3.email, user4.email);

  // Create multiple groups with different configurations
  const group1 = await prisma.group.upsert({
    where: { id: 'seed-group-alice-admin' },
    update: {},
    create: {
      id: 'seed-group-alice-admin',
      name: "Alice's Sports Club",
      description: 'A group for organizing weekly sports events',
      isPublic: true,
      city: 'New York',
      country: 'USA',
      latitude: 40.7128,
      longitude: -74.0060,
      locationName: 'New York City',
      creatorId: user1.id,
      members: {
        create: [
          {
            userId: user1.id,
            role: 'admin'
          },
          {
            userId: user2.id,
            role: 'member'
          },
          {
            userId: user3.id,
            role: 'member'
          }
        ]
      }
    }
  });
  console.log('Seeded group:', group1.name, '(Alice as admin)');

  const group2 = await prisma.group.upsert({
    where: { id: 'seed-group-bob-admin' },
    update: {},
    create: {
      id: 'seed-group-bob-admin',
      name: "Bob's Basketball League",
      description: 'Competitive basketball games every weekend',
      isPublic: true,
      city: 'Los Angeles',
      country: 'USA',
      latitude: 34.0522,
      longitude: -118.2437,
      locationName: 'Los Angeles',
      creatorId: user2.id,
      members: {
        create: [
          {
            userId: user2.id,
            role: 'admin'
          },
          {
            userId: user1.id,
            role: 'member'
          },
          {
            userId: user4.id,
            role: 'member'
          }
        ]
      }
    }
  });
  console.log('Seeded group:', group2.name, '(Bob as admin)');

  const group3 = await prisma.group.upsert({
    where: { id: 'seed-group-charlie-private' },
    update: {},
    create: {
      id: 'seed-group-charlie-private',
      name: "Charlie's Tennis Club",
      description: 'Private tennis club for members only',
      isPublic: false,
      city: 'Chicago',
      country: 'USA',
      latitude: 41.8781,
      longitude: -87.6298,
      locationName: 'Chicago',
      creatorId: user3.id,
      members: {
        create: [
          {
            userId: user3.id,
            role: 'admin'
          },
          {
            userId: user2.id,
            role: 'member'
          }
        ]
      }
    }
  });
  console.log('Seeded group:', group3.name, '(Charlie as admin, private)');

  // Add two public groups in Sherbrooke, QC that Alice is NOT part of
  const group4 = await prisma.group.upsert({
    where: { id: 'seed-group-sherbrooke-hockey' },
    update: {},
    create: {
      id: 'seed-group-sherbrooke-hockey',
      name: "Sherbrooke Ice Hockey League",
      description: 'Weekly ice hockey games and tournaments in Sherbrooke. All skill levels welcome!',
      isPublic: true,
      city: 'Sherbrooke',
      country: 'Canada',
      latitude: 45.4042,
      longitude: -71.8929,
      locationName: 'Sherbrooke, QC',
      creatorId: user2.id,
      members: {
        create: [
          {
            userId: user2.id,
            role: 'admin'
          },
          {
            userId: user3.id,
            role: 'member'
          },
          {
            userId: user4.id,
            role: 'member'
          }
        ]
      }
    }
  });
  console.log('Seeded group:', group4.name, '(Bob as admin, Sherbrooke)');

  const group5 = await prisma.group.upsert({
    where: { id: 'seed-group-sherbrooke-soccer' },
    update: {},
    create: {
      id: 'seed-group-sherbrooke-soccer',
      name: "Sherbrooke Soccer Community",
      description: 'Outdoor soccer matches and friendly games in beautiful Sherbrooke parks',
      isPublic: true,
      city: 'Sherbrooke',
      country: 'Canada',
      latitude: 45.4042,
      longitude: -71.8929,
      locationName: 'Sherbrooke, QC',
      creatorId: user4.id,
      members: {
        create: [
          {
            userId: user4.id,
            role: 'admin'
          },
          {
            userId: user2.id,
            role: 'member'
          },
          {
            userId: user3.id,
            role: 'moderator'
          }
        ]
      }
    }
  });
  console.log('Seeded group:', group5.name, '(Diana as admin, Sherbrooke)');

  // Add a public group in Montreal with Charlie as owner
  const group6 = await prisma.group.upsert({
    where: { id: 'seed-group-montreal-charlie' },
    update: {},
    create: {
      id: 'seed-group-montreal-charlie',
      name: "Montreal Sports League",
      description: 'Public sports league in Montreal for all types of sports and tournaments',
      isPublic: true,
      city: 'Montreal',
      country: 'Canada',
      latitude: 45.5017,
      longitude: -73.5673,
      locationName: 'Montreal, QC',
      creatorId: user3.id,
      members: {
        create: [
          {
            userId: user3.id,
            role: 'admin'
          },
          {
            userId: user1.id,
            role: 'member'
          },
          {
            userId: user2.id,
            role: 'member'
          },
          {
            userId: user4.id,
            role: 'moderator'
          }
        ]
      }
    }
  });
  console.log('Seeded group:', group6.name, '(Charlie as admin, Montreal)');

  // Create multiple events across different groups
  const events = [
    // Group 1 (Alice's Sports Club) events
    {
      title: 'Weekend Football Match',
      description: 'Join us for a friendly football match this weekend!',
      sessionType: 'football',
      location: 'Central Park Field 3',
      city: 'New York',
      country: 'USA',
      latitude: 40.7829,
      longitude: -73.9654,
      locationName: 'Central Park',
      startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours duration
      maxPlayers: 20,
      isPublic: true,
      status: 'upcoming',
      creatorId: user1.id,
      groupId: group1.id,
      participants: [
        { userId: user1.id, status: 'confirmed' },
        { userId: user2.id, status: 'confirmed' },
        { userId: user3.id, status: 'pending' }
      ]
    },
      // Additional upcoming events for Alice's Sports Club
      {
        title: 'Spring Soccer Kickoff',
        description: 'Start the season with a friendly soccer match!',
        sessionType: 'football',
        location: 'East Meadow Field',
        city: 'New York',
        country: 'USA',
        latitude: 40.7851,
        longitude: -73.9683,
        locationName: 'East Meadow',
        startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        maxPlayers: 18,
        isPublic: true,
        status: 'upcoming',
        creatorId: user1.id,
        groupId: group1.id,
        participants: [
          { userId: user1.id, status: 'confirmed' },
          { userId: user2.id, status: 'pending' }
        ]
      },
      {
        title: 'Ultimate Frisbee Challenge',
        description: 'Join us for a fast-paced frisbee game!',
        sessionType: 'other',
        location: 'Great Lawn',
        city: 'New York',
        country: 'USA',
        latitude: 40.7712,
        longitude: -73.9742,
        locationName: 'Great Lawn',
        startTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        endTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000),
        maxPlayers: 14,
        isPublic: true,
        status: 'upcoming',
        creatorId: user1.id,
        groupId: group1.id,
        participants: [
          { userId: user1.id, status: 'confirmed' },
          { userId: user3.id, status: 'pending' }
        ]
      },
      {
        title: 'Volleyball Night',
        description: 'Evening volleyball games for all skill levels.',
        sessionType: 'volleyball',
        location: 'Pier 25 Volleyball Courts',
        city: 'New York',
        country: 'USA',
        latitude: 40.7209,
        longitude: -74.0113,
        locationName: 'Pier 25',
        startTime: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
        endTime: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        maxPlayers: 12,
        isPublic: true,
        status: 'upcoming',
        creatorId: user1.id,
        groupId: group1.id,
        participants: [
          { userId: user1.id, status: 'confirmed' },
          { userId: user2.id, status: 'confirmed' }
        ]
      },
      // Additional past events for Alice's Sports Club
      {
        title: 'Winter Indoor Soccer',
        description: 'Indoor soccer to keep warm during winter!',
        sessionType: 'football',
        location: 'Chelsea Piers',
        city: 'New York',
        country: 'USA',
        latitude: 40.7465,
        longitude: -74.0071,
        locationName: 'Chelsea Piers',
        startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        endTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        maxPlayers: 16,
        isPublic: true,
        status: 'completed',
        creatorId: user1.id,
        groupId: group1.id,
        participants: [
          { userId: user1.id, status: 'confirmed' },
          { userId: user2.id, status: 'confirmed' }
        ]
      },
      {
        title: 'Autumn Running Meetup',
        description: 'Group run through Central Park to enjoy the fall colors.',
        sessionType: 'running',
        location: 'Central Park',
        city: 'New York',
        country: 'USA',
        latitude: 40.7829,
        longitude: -73.9654,
        locationName: 'Central Park',
        startTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        endTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        maxPlayers: 10,
        isPublic: true,
        status: 'completed',
        creatorId: user1.id,
        groupId: group1.id,
        participants: [
          { userId: user1.id, status: 'confirmed' },
          { userId: user3.id, status: 'confirmed' }
        ]
      },
    {
      title: 'Morning Yoga Session',
      description: 'Relaxing morning yoga session at the park',
      sessionType: 'other',
      location: 'Central Park Great Lawn',
      city: 'New York',
      country: 'USA',
      latitude: 40.7794,
      longitude: -73.9654,
      locationName: 'Central Park Great Lawn',
      startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000), // 1 hour duration
      maxPlayers: 15,
      isPublic: true,
      status: 'completed',
      creatorId: user1.id,
      groupId: group1.id,
      participants: [
        { userId: user1.id, status: 'confirmed' },
        { userId: user2.id, status: 'confirmed' },
        { userId: user3.id, status: 'confirmed' }
      ]
    },
    // Group 2 (Bob's Basketball League) events
    {
      title: 'Basketball Pickup Game',
      description: 'Join us for a casual basketball game!',
      sessionType: 'basketball',
      location: 'Downtown Gym',
      city: 'Los Angeles',
      country: 'USA',
      latitude: 34.0407,
      longitude: -118.2468,
      locationName: 'LA Downtown Gym',
      startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000), // 1.5 hours duration
      maxPlayers: 10,
      isPublic: true,
      status: 'upcoming',
      creatorId: user2.id,
      groupId: group2.id,
      participants: [
        { userId: user2.id, status: 'confirmed' },
        { userId: user1.id, status: 'confirmed' },
        { userId: user4.id, status: 'pending' }
      ]
    },
    {
      title: 'Championship Game',
      description: 'Final championship game of the season!',
      sessionType: 'basketball',
      location: 'Staples Center',
      city: 'Los Angeles',
      country: 'USA',
      latitude: 34.0430,
      longitude: -118.2673,
      locationName: 'Staples Center',
      startTime: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
      endTime: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours duration
      maxPlayers: 12,
      isPublic: false,
      status: 'upcoming',
      creatorId: user2.id,
      groupId: group2.id,
      participants: [
        { userId: user2.id, status: 'confirmed' },
        { userId: user4.id, status: 'confirmed' }
      ]
    },
    // Group 3 (Charlie's Tennis Club) events
    {
      title: 'Private Tennis Clinic',
      description: 'Members-only tennis coaching session',
      sessionType: 'tennis',
      location: 'Lincoln Park Tennis Courts',
      city: 'Chicago',
      country: 'USA',
      latitude: 41.9224,
      longitude: -87.6359,
      locationName: 'Lincoln Park Courts',
      startTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      endTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours duration
      maxPlayers: 8,
      isPublic: false,
      status: 'upcoming',
      creatorId: user3.id,
      groupId: group3.id,
      participants: [
        { userId: user3.id, status: 'confirmed' },
        { userId: user2.id, status: 'confirmed' }
      ]
    }
  ];

  const createdEvents = [];
  for (const eventData of events) {
    const event = await prisma.session.create({
      data: {
        ...eventData,
        participants: {
          create: eventData.participants
        }
      }
    });
    createdEvents.push(event);
    console.log('Seeded event:', eventData.title);
  }

  const weekendFootballEvent = createdEvents.find(event => event.title === 'Weekend Football Match');
  const springSoccerEvent = createdEvents.find(event => event.title === 'Spring Soccer Kickoff');
  const autumnRunningEvent = createdEvents.find(event => event.title === 'Autumn Running Meetup');
  const morningYogaEvent = createdEvents.find(event => event.title === 'Morning Yoga Session');

  if (!weekendFootballEvent || !springSoccerEvent || !autumnRunningEvent || !morningYogaEvent) {
    throw new Error('Required seed events were not created successfully');
  }

  // Seed newer event participant states introduced after the original seed set.
  await prisma.sessionParticipant.upsert({
    where: {
      sessionId_userId: {
        sessionId: weekendFootballEvent.id,
        userId: user4.id,
      }
    },
    update: { status: 'waitlisted' },
    create: {
      id: 'seed-event-participant-waitlisted-1',
      sessionId: weekendFootballEvent.id,
      userId: user4.id,
      status: 'waitlisted'
    }
  });

  await prisma.sessionParticipant.upsert({
    where: {
      sessionId_userId: {
        sessionId: springSoccerEvent.id,
        userId: user3.id,
      }
    },
    update: { status: 'co_organizer' },
    create: {
      id: 'seed-event-participant-coorganizer-1',
      sessionId: springSoccerEvent.id,
      userId: user3.id,
      status: 'co_organizer'
    }
  });

  // Seed invite-link metadata on one public group and one event.
  await prisma.group.update({
    where: { id: group1.id },
    data: {
      inviteToken: 'seed-group-invite-token-1',
      inviteTokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.session.update({
    where: { id: weekendFootballEvent.id },
    data: {
      inviteToken: 'seed-event-invite-token-1',
      inviteTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  // Create group notifications
  console.log('\nSeeding group notifications...');
  await prisma.groupNotification.upsert({
    where: { id: 'seed-group-notif-1' },
    update: {},
    create: {
      id: 'seed-group-notif-1',
      groupId: group1.id,
      userId: user2.id,
      type: 'accepted',
      params: { groupName: group1.name, userName: 'Alice' },
      read: true,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
    }
  });

  await prisma.groupNotification.upsert({
    where: { id: 'seed-group-notif-2' },
    update: {},
    create: {
      id: 'seed-group-notif-2',
      groupId: group2.id,
      userId: user1.id,
      type: 'accepted',
      params: { groupName: group2.name, userName: 'Bob' },
      read: false,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    }
  });

  await prisma.groupNotification.upsert({
    where: { id: 'seed-group-notif-3' },
    update: {},
    create: {
      id: 'seed-group-notif-3',
      groupId: group3.id,
      userId: user2.id,
      type: 'invited',
      params: { groupName: group3.name, inviterName: 'Charlie' },
      read: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    }
  });
  console.log('Seeded 3 group notifications');

  // Create event notifications
  console.log('\nSeeding event notifications...');
  await prisma.sessionNotification.upsert({
    where: { id: 'seed-event-notif-1' },
    update: {},
    create: {
      id: 'seed-event-notif-1',
      sessionId: createdEvents[0].id,
      userId: user1.id,
      type: 'join',
      params: { userName: 'Bob', eventTitle: createdEvents[0].title },
      metadata: { status: 'confirmed' },
      read: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    }
  });

  await prisma.sessionNotification.upsert({
    where: { id: 'seed-event-notif-2' },
    update: {},
    create: {
      id: 'seed-event-notif-2',
      sessionId: createdEvents[0].id,
      userId: user2.id,
      type: 'confirmed',
      params: { userName: 'Charlie', eventTitle: createdEvents[0].title },
      metadata: { previousStatus: 'pending', newStatus: 'confirmed' },
      read: true,
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
    }
  });

  await prisma.sessionNotification.upsert({
    where: { id: 'seed-event-notif-3' },
    update: {},
    create: {
      id: 'seed-event-notif-3',
      sessionId: createdEvents[1].id,
      userId: user3.id,
      type: 'late',
      params: { userName: 'Bob', eventTitle: createdEvents[1].title },
      metadata: { minutesLate: 15 },
      read: false,
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
    }
  });

  await prisma.sessionNotification.upsert({
    where: { id: 'seed-event-notif-4' },
    update: {},
    create: {
      id: 'seed-event-notif-4',
      sessionId: createdEvents[3].id,
      userId: user1.id,
      type: 'status_change',
      params: { eventTitle: createdEvents[3].title, newStatus: 'confirmed' },
      metadata: { changedBy: 'Bob' },
      read: false,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
    }
  });

  await prisma.sessionNotification.upsert({
    where: { id: 'seed-event-notif-5' },
    update: {
      type: 'session_updated',
      params: { userName: user3.name, eventTitle: weekendFootballEvent.title },
      metadata: { updatedFields: ['location', 'startTime'] },
      read: false,
    },
    create: {
      id: 'seed-event-notif-5',
      sessionId: weekendFootballEvent.id,
      userId: user3.id,
      type: 'session_updated',
      params: { userName: user3.name, eventTitle: weekendFootballEvent.title },
      metadata: { updatedFields: ['location', 'startTime'] },
      read: false,
      createdAt: new Date(Date.now() - 90 * 60 * 1000)
    }
  });

  await prisma.sessionNotification.upsert({
    where: { id: 'seed-event-notif-6' },
    update: {
      type: 'session_cancelled',
      params: { userName: user1.name, eventTitle: morningYogaEvent.title },
      metadata: { reason: 'Weather alert' },
      read: true,
    },
    create: {
      id: 'seed-event-notif-6',
      sessionId: morningYogaEvent.id,
      userId: user1.id,
      type: 'session_cancelled',
      params: { userName: user1.name, eventTitle: morningYogaEvent.title },
      metadata: { reason: 'Weather alert' },
      read: true,
      createdAt: new Date(Date.now() - 45 * 60 * 1000)
    }
  });
  console.log('Seeded 6 event notifications');


  // Seed newer moderation, invitation, and attendance models.
  await prisma.groupJoinRequest.upsert({
    where: { id: 'seed-group-request-1' },
    update: {},
    create: {
      id: 'seed-group-request-1',
      groupId: group4.id,
      userId: user1.id,
      status: 'pending',
      createdBy: 'USER'
    }
  });

  await prisma.groupJoinRequest.upsert({
    where: { id: 'seed-group-request-2' },
    update: {},
    create: {
      id: 'seed-group-request-2',
      groupId: group1.id,
      userId: user4.id,
      status: 'pending',
      createdBy: 'INVITE',
      invitedBy: user1.id,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.inviteLog.upsert({
    where: { id: 'seed-invite-log-1' },
    update: {},
    create: {
      id: 'seed-invite-log-1',
      inviterType: 'group',
      entityId: group1.id,
      inviterId: user1.id,
      inviteeEmail: user4.email,
      inviteeId: user4.id,
      status: 'sent',
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      message: 'Join our weekly sports group!'
    }
  });

  await prisma.inviteLog.upsert({
    where: { id: 'seed-invite-log-2' },
    update: {},
    create: {
      id: 'seed-invite-log-2',
      inviterType: 'event',
      entityId: weekendFootballEvent.id,
      inviterId: user3.id,
      inviteeEmail: user4.email,
      inviteeId: user4.id,
      status: 'accepted',
      respondedAt: new Date(Date.now() - 30 * 60 * 1000),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      metadata: { source: 'seed-script' }
    }
  });

  await prisma.groupBan.upsert({
    where: { id: 'seed-group-ban-1' },
    update: {},
    create: {
      id: 'seed-group-ban-1',
      groupId: group5.id,
      userId: user1.id,
      bannedBy: user4.id,
      reason: 'Seeded moderation example'
    }
  });

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-log-1' },
    update: {},
    create: {
      id: 'seed-audit-log-1',
      entityType: 'group',
      entityId: group5.id,
      actorId: user4.id,
      action: 'ban_user',
      metadata: { targetUserId: user1.id, reason: 'Seeded moderation example' }
    }
  });

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-log-2' },
    update: {},
    create: {
      id: 'seed-audit-log-2',
      entityType: 'group',
      entityId: group1.id,
      actorId: user1.id,
      action: 'invite_user',
      metadata: { invitedUserId: user4.id }
    }
  });

  await prisma.auditLog.upsert({
    where: { id: 'seed-audit-log-3' },
    update: {},
    create: {
      id: 'seed-audit-log-3',
      entityType: 'event',
      entityId: weekendFootballEvent.id,
      actorId: user3.id,
      action: 'update_event',
      metadata: { updatedFields: ['location', 'startTime'] }
    }
  });

  console.log('\nSeeding event requests...');
  const eventRequest1 = await prisma.sessionRequest.upsert({
    where: { id: 'seed-event-request-1' },
    update: {},
    create: {
      id: 'seed-event-request-1',
      title: 'Saturday Skills Clinic',
      description: 'Requesting a coached clinic before the next football match for positioning and passing drills.',
      eventType: 'football',
      location: 'Central Park Training Zone',
      startTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
      maxPlayers: 16,
      status: 'voting',
      voteDeadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      voteThreshold: 0.6,
      creatorId: user2.id,
      groupId: group1.id,
    }
  });

  const eventRequest2 = await prisma.sessionRequest.upsert({
    where: { id: 'seed-event-request-2' },
    update: {},
    create: {
      id: 'seed-event-request-2',
      title: 'Sunrise Recovery Run',
      description: 'A low-intensity group recovery run after the autumn meetup series.',
      eventType: 'running',
      location: 'Reservoir Loop',
      startTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 75 * 60 * 1000),
      maxPlayers: 12,
      status: 'finalized',
      voteDeadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      voteThreshold: 0.5,
      creatorId: user3.id,
      groupId: group1.id,
      finalizedSessionId: springSoccerEvent.id,
    }
  });

  const eventRequest3 = await prisma.sessionRequest.upsert({
    where: { id: 'seed-event-request-3' },
    update: {},
    create: {
      id: 'seed-event-request-3',
      title: 'Late Night Half-Court Shootout',
      description: 'Short-format half-court games with music and scorekeeping.',
      eventType: 'basketball',
      location: 'Downtown Gym Annex',
      startTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      maxPlayers: 10,
      status: 'cancelled',
      voteDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      voteThreshold: 0.5,
      creatorId: user4.id,
      groupId: group2.id,
    }
  });

  const eventRequest4 = await prisma.sessionRequest.upsert({
    where: { id: 'seed-event-request-4' },
    update: {},
    create: {
      id: 'seed-event-request-4',
      title: 'Montreal Mixed-Sports Social',
      description: 'A social event with rotating mini-games for new members to meet each other.',
      eventType: 'other',
      location: 'Parc du Mont-Royal',
      startTime: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      maxPlayers: 24,
      status: 'expired',
      voteDeadline: new Date(Date.now() - 6 * 60 * 60 * 1000),
      voteThreshold: 0.55,
      creatorId: user4.id,
      groupId: group6.id,
    }
  });

  await prisma.sessionVote.upsert({
    where: {
      sessionRequestId_userId: {
        sessionRequestId: eventRequest1.id,
        userId: user1.id,
      }
    },
    update: { vote: 'yes' },
    create: {
      sessionRequestId: eventRequest1.id,
      userId: user1.id,
      vote: 'yes'
    }
  });

  await prisma.sessionVote.upsert({
    where: {
      sessionRequestId_userId: {
        sessionRequestId: eventRequest1.id,
        userId: user3.id,
      }
    },
    update: { vote: 'yes' },
    create: {
      sessionRequestId: eventRequest1.id,
      userId: user3.id,
      vote: 'yes'
    }
  });

  await prisma.sessionVote.upsert({
    where: {
      sessionRequestId_userId: {
        sessionRequestId: eventRequest2.id,
        userId: user1.id,
      }
    },
    update: { vote: 'yes' },
    create: {
      sessionRequestId: eventRequest2.id,
      userId: user1.id,
      vote: 'yes'
    }
  });

  await prisma.sessionVote.upsert({
    where: {
      sessionRequestId_userId: {
        sessionRequestId: eventRequest2.id,
        userId: user2.id,
      }
    },
    update: { vote: 'yes' },
    create: {
      sessionRequestId: eventRequest2.id,
      userId: user2.id,
      vote: 'yes'
    }
  });

  await prisma.sessionVote.upsert({
    where: {
      sessionRequestId_userId: {
        sessionRequestId: eventRequest3.id,
        userId: user2.id,
      }
    },
    update: { vote: 'yes' },
    create: {
      sessionRequestId: eventRequest3.id,
      userId: user2.id,
      vote: 'yes'
    }
  });

  await prisma.sessionVote.upsert({
    where: {
      sessionRequestId_userId: {
        sessionRequestId: eventRequest3.id,
        userId: user1.id,
      }
    },
    update: { vote: 'no' },
    create: {
      sessionRequestId: eventRequest3.id,
      userId: user1.id,
      vote: 'no'
    }
  });

  await prisma.sessionVote.upsert({
    where: {
      sessionRequestId_userId: {
        sessionRequestId: eventRequest4.id,
        userId: user3.id,
      }
    },
    update: { vote: 'yes' },
    create: {
      sessionRequestId: eventRequest4.id,
      userId: user3.id,
      vote: 'yes'
    }
  });

  console.log('Seeded 4 event requests and 7 event votes');

  await prisma.sessionAttendance.upsert({
    where: {
      sessionId_userId: {
        sessionId: autumnRunningEvent.id,
        userId: user1.id,
      }
    },
    update: { status: 'on_time' },
    create: {
      id: 'seed-attendance-1',
      sessionId: autumnRunningEvent.id,
      userId: user1.id,
      status: 'on_time'
    }
  });

  await prisma.sessionAttendance.upsert({
    where: {
      sessionId_userId: {
        sessionId: autumnRunningEvent.id,
        userId: user3.id,
      }
    },
    update: { status: 'late' },
    create: {
      id: 'seed-attendance-2',
      sessionId: autumnRunningEvent.id,
      userId: user3.id,
      status: 'late'
    }
  });

  await prisma.sessionAttendance.upsert({
    where: {
      sessionId_userId: {
        sessionId: morningYogaEvent.id,
        userId: user2.id,
      }
    },
    update: { status: 'on_time' },
    create: {
      id: 'seed-attendance-3',
      sessionId: morningYogaEvent.id,
      userId: user2.id,
      status: 'on_time'
    }
  });
  console.log('Seeded join requests, invite logs, bans, audit logs, and attendance records');

  // Create TeamUp requests
  console.log('\nSeeding TeamUp requests...');
  const teamUp1 = await prisma.teamUpRequest.upsert({
    where: { id: 'seed-teamup-1' },
    update: {},
    create: {
      id: 'seed-teamup-1',
      title: 'Need 2 players for football match',
      description: 'Looking for 2 substitute players for our football match this Saturday',
      sportType: 'football',
      requestType: 'need_players',
      location: 'Central Park Field 5',
      city: 'New York',
      country: 'USA',
      latitude: 40.7829,
      longitude: -73.9654,
      locationName: 'Central Park',
      dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      playersNeeded: 2,
      skillLevel: 'intermediate',
      status: 'open',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      creatorId: user1.id,
    }
  });

  const teamUp2 = await prisma.teamUpRequest.upsert({
    where: { id: 'seed-teamup-2' },
    update: {},
    create: {
      id: 'seed-teamup-2',
      title: 'Basketball sub needed urgently',
      description: 'One of our players got injured, need 1 replacement for tonight',
      sportType: 'basketball',
      requestType: 'need_players',
      location: 'Downtown Gym',
      city: 'Los Angeles',
      country: 'USA',
      latitude: 34.0407,
      longitude: -118.2468,
      locationName: 'LA Downtown Gym',
      dateTime: new Date(Date.now() + 0.5 * 24 * 60 * 60 * 1000), // 12 hours from now
      playersNeeded: 1,
      skillLevel: 'any',
      status: 'open',
      expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
      creatorId: user2.id,
    }
  });

  const teamUp3 = await prisma.teamUpRequest.upsert({
    where: { id: 'seed-teamup-3' },
    update: {},
    create: {
      id: 'seed-teamup-3',
      title: 'Tennis doubles partner needed',
      description: 'Looking for an advanced player for doubles tournament',
      sportType: 'tennis',
      requestType: 'need_players',
      location: 'Lincoln Park Tennis Courts',
      city: 'Chicago',
      country: 'USA',
      latitude: 41.9224,
      longitude: -87.6359,
      locationName: 'Lincoln Park Courts',
      dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      playersNeeded: 1,
      skillLevel: 'advanced',
      status: 'filled',
      expiresAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
      creatorId: user3.id,
    }
  });

  // TeamUp request with looking_for_play type (user is looking for a game to join)
  const teamUp4 = await prisma.teamUpRequest.upsert({
    where: { id: 'seed-teamup-4' },
    update: {},
    create: {
      id: 'seed-teamup-4',
      title: 'Looking for a volleyball game this weekend',
      description: 'Experienced volleyball player available this weekend, looking to join a game or team',
      sportType: 'volleyball',
      requestType: 'looking_for_play',
      city: 'New York',
      country: 'USA',
      latitude: 40.7128,
      longitude: -74.0060,
      locationName: 'New York City',
      dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      playersNeeded: 1,
      skillLevel: 'intermediate',
      status: 'open',
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
      creatorId: user4.id,
    }
  });

  // Another looking_for_play request
  const teamUp5 = await prisma.teamUpRequest.upsert({
    where: { id: 'seed-teamup-5' },
    update: {},
    create: {
      id: 'seed-teamup-5',
      title: 'Available for hockey games – intermediate skater',
      description: 'Looking for a pickup hockey game or team that needs a forward. Available weekday evenings.',
      sportType: 'iceHockey',
      requestType: 'looking_for_play',
      city: 'Montreal',
      country: 'Canada',
      latitude: 45.5017,
      longitude: -73.5673,
      locationName: 'Montreal, QC',
      dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      playersNeeded: 1,
      skillLevel: 'intermediate',
      status: 'open',
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      creatorId: user2.id,
    }
  });
  console.log('Seeded 5 TeamUp requests (3 need_players, 2 looking_for_play)');

  // Create TeamUp responses
  console.log('\nSeeding TeamUp responses...');
  await prisma.teamUpResponse.upsert({
    where: { id: 'seed-teamup-response-1' },
    update: {},
    create: {
      id: 'seed-teamup-response-1',
      teamUpRequestId: teamUp1.id,
      userId: user3.id,
      message: 'I can make it! Count me in.',
      status: 'accepted',
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
    }
  });

  await prisma.teamUpResponse.upsert({
    where: { id: 'seed-teamup-response-2' },
    update: {},
    create: {
      id: 'seed-teamup-response-2',
      teamUpRequestId: teamUp1.id,
      userId: user4.id,
      message: "I'm interested but need to check my schedule",
      status: 'pending',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
    }
  });

  await prisma.teamUpResponse.upsert({
    where: { id: 'seed-teamup-response-3' },
    update: {},
    create: {
      id: 'seed-teamup-response-3',
      teamUpRequestId: teamUp2.id,
      userId: user1.id,
      message: 'Sorry, I have plans tonight',
      status: 'declined',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    }
  });

  await prisma.teamUpResponse.upsert({
    where: { id: 'seed-teamup-response-4' },
    update: {},
    create: {
      id: 'seed-teamup-response-4',
      teamUpRequestId: teamUp3.id,
      userId: user2.id,
      message: "I'd love to join! I've been playing for 10 years.",
      status: 'accepted',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    }
  });
  console.log('Seeded 4 TeamUp responses');

  // Create TeamUp notifications
  console.log('\nSeeding TeamUp notifications...');
  await prisma.teamUpNotification.upsert({
    where: { id: 'seed-teamup-notif-1' },
    update: {},
    create: {
      id: 'seed-teamup-notif-1',
      teamUpRequestId: teamUp1.id,
      userId: user1.id,
      type: 'teamup_response',
      params: { name: 'Charlie', title: teamUp1.title, sportType: 'football' },
      metadata: { responseStatus: 'accepted' },
      read: false,
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
    }
  });

  await prisma.teamUpNotification.upsert({
    where: { id: 'seed-teamup-notif-2' },
    update: {},
    create: {
      id: 'seed-teamup-notif-2',
      teamUpRequestId: teamUp1.id,
      userId: user1.id,
      type: 'teamup_response',
      params: { name: 'Diana', title: teamUp1.title, sportType: 'football' },
      metadata: { responseStatus: 'pending' },
      read: false,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
    }
  });

  await prisma.teamUpNotification.upsert({
    where: { id: 'seed-teamup-notif-3' },
    update: {},
    create: {
      id: 'seed-teamup-notif-3',
      teamUpRequestId: teamUp2.id,
      userId: user2.id,
      type: 'teamup_declined',
      params: { name: 'Alice', title: teamUp2.title, sportType: 'basketball' },
      metadata: { responseStatus: 'declined' },
      read: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    }
  });

  await prisma.teamUpNotification.upsert({
    where: { id: 'seed-teamup-notif-4' },
    update: {},
    create: {
      id: 'seed-teamup-notif-4',
      teamUpRequestId: teamUp3.id,
      userId: user3.id,
      type: 'teamup_accepted',
      params: { name: 'Bob', title: teamUp3.title, sportType: 'tennis' },
      metadata: { responseStatus: 'accepted' },
      read: true,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    }
  });

  await prisma.teamUpNotification.upsert({
    where: { id: 'seed-teamup-notif-5' },
    update: {},
    create: {
      id: 'seed-teamup-notif-5',
      teamUpRequestId: teamUp1.id,
      userId: user2.id,
      type: 'teamup_nearby',
      params: { title: teamUp1.title, sportType: 'football', distance: '5 km' },
      metadata: { location: teamUp1.locationName },
      read: false,
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
    }
  });
  console.log('Seeded 5 TeamUp notifications');

  // Create event reminders
  console.log('\nSeeding event reminders...');
  await prisma.sessionReminder.upsert({
    where: { id: 'seed-reminder-1' },
    update: {},
    create: {
      id: 'seed-reminder-1',
      sessionId: createdEvents[0].id,
      userId: user1.id,
      remindAt: new Date(createdEvents[0].startTime.getTime() - 24 * 60 * 60 * 1000), // 24 hours before
      sent: false
    }
  });

  await prisma.sessionReminder.upsert({
    where: { id: 'seed-reminder-2' },
    update: {},
    create: {
      id: 'seed-reminder-2',
      sessionId: createdEvents[0].id,
      userId: user2.id,
      remindAt: new Date(createdEvents[0].startTime.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
      sent: false
    }
  });

  await prisma.sessionReminder.upsert({
    where: { id: 'seed-reminder-3' },
    update: {},
    create: {
      id: 'seed-reminder-3',
      sessionId: createdEvents[2].id, // Past event
      userId: user1.id,
      remindAt: new Date(createdEvents[2].startTime.getTime() - 1 * 60 * 60 * 1000), // 1 hour before
      sent: true
    }
  });
  console.log('Seeded 3 event reminders');

  // Create comments on events
  console.log('\nSeeding event comments...');
  await prisma.comment.upsert({
    where: { id: 'seed-comment-1' },
    update: {},
    create: {
      id: 'seed-comment-1',
      sessionId: createdEvents[0].id,
      userId: user2.id,
      content: 'Looking forward to this match! Should we bring extra balls?',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    }
  });

  await prisma.comment.upsert({
    where: { id: 'seed-comment-2' },
    update: {},
    create: {
      id: 'seed-comment-2',
      sessionId: createdEvents[0].id,
      userId: user1.id,
      content: 'Good idea! I will bring two extra balls.',
      createdAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000), // 1.5 days ago
      parentId: 'seed-comment-1'
    }
  });

  await prisma.comment.upsert({
    where: { id: 'seed-comment-3' },
    update: {},
    create: {
      id: 'seed-comment-3',
      sessionId: createdEvents[3].id,
      userId: user4.id,
      content: 'What time should we arrive? 30 minutes early for warmup?',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
    }
  });

  await prisma.comment.upsert({
    where: { id: 'seed-comment-4' },
    update: {},
    create: {
      id: 'seed-comment-4',
      sessionId: createdEvents[3].id,
      userId: user2.id,
      content: 'Yes, 30 minutes early would be perfect for warmup!',
      createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000), // 10 hours ago
      parentId: 'seed-comment-3'
    }
  });
  console.log('Seeded 4 event comments');

  // Create guest participants
  console.log('\nSeeding guest participants...');
  await prisma.guestParticipant.upsert({
    where: { id: 'seed-guest-1' },
    update: {},
    create: {
      id: 'seed-guest-1',
      sessionId: createdEvents[0].id,
      name: 'John Doe',
      status: 'confirmed',
      joinedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    }
  });

  await prisma.guestParticipant.upsert({
    where: { id: 'seed-guest-2' },
    update: {},
    create: {
      id: 'seed-guest-2',
      sessionId: createdEvents[0].id,
      name: 'Jane Smith',
      status: 'confirmed',
      joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    }
  });

  await prisma.guestParticipant.upsert({
    where: { id: 'seed-guest-3' },
    update: {},
    create: {
      id: 'seed-guest-3',
      sessionId: createdEvents[3].id,
      name: 'Mike Johnson',
      status: 'confirmed',
      joinedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    }
  });

  await prisma.guestParticipant.upsert({
    where: { id: 'seed-guest-4' },
    update: {},
    create: {
      id: 'seed-guest-4',
      sessionId: springSoccerEvent.id,
      name: 'Sophie Turner',
      status: 'confirmed',
      joinedAt: new Date(Date.now() - 36 * 60 * 60 * 1000)
    }
  });

  await prisma.guestParticipant.upsert({
    where: { id: 'seed-guest-5' },
    update: {},
    create: {
      id: 'seed-guest-5',
      sessionId: springSoccerEvent.id,
      name: 'Liam Carter',
      status: 'confirmed',
      joinedAt: new Date(Date.now() - 30 * 60 * 60 * 1000)
    }
  });

  await prisma.guestParticipant.upsert({
    where: { id: 'seed-guest-6' },
    update: {},
    create: {
      id: 'seed-guest-6',
      sessionId: weekendFootballEvent.id,
      name: 'Emma Brooks',
      status: 'declined',
      joinedAt: new Date(Date.now() - 18 * 60 * 60 * 1000)
    }
  });

  await prisma.guestParticipant.upsert({
    where: { id: 'seed-guest-7' },
    update: {},
    create: {
      id: 'seed-guest-7',
      sessionId: createdEvents[7].id,
      name: 'Noah Ramirez',
      status: 'confirmed',
      joinedAt: new Date(Date.now() - 20 * 60 * 60 * 1000)
    }
  });

  await prisma.guestParticipant.upsert({
    where: { id: 'seed-guest-8' },
    update: {},
    create: {
      id: 'seed-guest-8',
      sessionId: createdEvents[9].id,
      name: 'Olivia Martin',
      status: 'confirmed',
      joinedAt: new Date(Date.now() - 8 * 60 * 60 * 1000)
    }
  });
  console.log('Seeded 8 guest participants');

  // Create tournaments with multiple pools
  console.log('\nSeeding tournaments with pools...');
  
  // Tournament 1: Football Tournament with 3 pools
  const tournament1 = await prisma.tournament.upsert({
    where: { id: 'seed-tournament-1' },
    update: {},
    create: {
      id: 'seed-tournament-1',
      name: 'Spring Football Championship',
      description: 'Annual spring football tournament with multiple skill divisions',
      sportType: 'football',
      format: 'round_robin',
      status: 'registration',
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      endDate: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000), // 32 days from now
      registrationStartDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (already open)
      registrationDeadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days from now
      maxTeams: 24,
      location: 'Central Sports Complex',
      city: 'New York',
      country: 'USA',
      latitude: 40.7589,
      longitude: -73.9851,
      locationName: 'Central Sports Complex',
      organizerId: user1.id,
      groupId: group1.id,
      isPublic: true,
      allowLateRegistration: false,
      autoGenerateBrackets: true,
      prizesDescription: 'Winner: $1000, Runner-up: $500',
      rulesDescription: 'Standard FIFA rules apply'
    }
  });

  // Create categories for tournament 1
  const cat1Beginners = await prisma.tournamentCategory.upsert({
    where: { tournamentId_name: { tournamentId: tournament1.id, name: 'Beginners' } },
    update: {},
    create: {
      id: 'seed-cat-1-beginners',
      name: 'Beginners',
      description: 'Open to teams new to competitive play',
      sortOrder: 0,
      tournamentId: tournament1.id
    }
  });

  const cat1Intermediate = await prisma.tournamentCategory.upsert({
    where: { tournamentId_name: { tournamentId: tournament1.id, name: 'Intermediate' } },
    update: {},
    create: {
      id: 'seed-cat-1-intermediate',
      name: 'Intermediate',
      description: 'For teams with some competitive experience',
      sortOrder: 1,
      tournamentId: tournament1.id
    }
  });

  const cat1Advanced = await prisma.tournamentCategory.upsert({
    where: { tournamentId_name: { tournamentId: tournament1.id, name: 'Advanced' } },
    update: {},
    create: {
      id: 'seed-cat-1-advanced',
      name: 'Advanced',
      description: 'For experienced competitive teams',
      sortOrder: 2,
      tournamentId: tournament1.id
    }
  });

  // Grant co_organizer role for tournament 1 to user2 (granted by user1/organizer)
  await prisma.tournamentAdminRole.upsert({
    where: { tournamentId_userId: { tournamentId: tournament1.id, userId: user2.id } },
    update: {},
    create: {
      id: 'seed-admin-role-1',
      tournamentId: tournament1.id,
      userId: user2.id,
      role: 'co_organizer',
      grantedById: user1.id
    }
  });

  // Create pools for tournament 1 (assigned to categories)
  const pool1A = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-1a' },
    update: {},
    create: {
      id: 'seed-pool-1a',
      name: 'Pool A - Beginners',
      description: 'For teams new to competitive football',
      maxTeams: 8,
      tournamentId: tournament1.id,
      categoryId: cat1Beginners.id
    }
  });

  const pool1B = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-1b' },
    update: {},
    create: {
      id: 'seed-pool-1b',
      name: 'Pool B - Intermediate',
      description: 'For teams with some competitive experience',
      maxTeams: 10,
      tournamentId: tournament1.id,
      categoryId: cat1Intermediate.id
    }
  });

  const pool1C = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-1c' },
    update: {},
    create: {
      id: 'seed-pool-1c',
      name: 'Pool C - Advanced',
      description: 'For experienced competitive teams',
      maxTeams: 6,
      tournamentId: tournament1.id,
      categoryId: cat1Advanced.id
    }
  });

  console.log('Created tournament 1 with 3 pools and 3 categories');

  // Create teams for Pool A (7 teams registered, 1 spot left)
  const teamNamesPoolA = [
    'Thunder Strikers', 'Lightning FC', 'Storm Chasers', 'Rookie Rockets',
    'Fresh Feet', 'Green Goalies', 'New Wave United'
  ];
  for (let i = 0; i < teamNamesPoolA.length; i++) {
    await prisma.tournamentTeam.upsert({
      where: { id: `seed-team-1a-${i}` },
      update: {},
      create: {
        id: `seed-team-1a-${i}`,
        name: teamNamesPoolA[i],
        captainName: `Captain ${teamNamesPoolA[i]}`,
        captainEmail: `captain.${i}@poolA.com`,
        captainUserId: null,
        seedNumber: i + 1,
        tournamentId: tournament1.id,
        poolId: pool1A.id,
        poolNumber: 1,
        poolName: pool1A.name,
        registrationOrder: i + 1
      }
    });
  }

  // Create teams for Pool B (10 teams registered, FULL)
  const teamNamesPoolB = [
    'Mid-Level Masters', 'Average Avengers', 'Decent Defenders', 'Fair Play FC',
    'Balanced Brigade', 'Moderate Movers', 'Standard Stars', 'Regular Rangers',
    'Neutral Netters', 'Even Eagles'
  ];
  for (let i = 0; i < teamNamesPoolB.length; i++) {
    await prisma.tournamentTeam.upsert({
      where: { id: `seed-team-1b-${i}` },
      update: {},
      create: {
        id: `seed-team-1b-${i}`,
        name: teamNamesPoolB[i],
        captainName: `Captain ${teamNamesPoolB[i]}`,
        captainEmail: `captain.${i}@poolB.com`,
        captainUserId: null,
        seedNumber: i + 1,
        tournamentId: tournament1.id,
        poolId: pool1B.id,
        poolNumber: 2,
        poolName: pool1B.name,
        registrationOrder: i + 1
      }
    });
  }

  // Create 2 teams on waitlist for Pool B
  const waitlistTeamB1 = await prisma.tournamentTeam.upsert({
    where: { id: 'seed-team-1b-waitlist-1' },
    update: {},
    create: {
      id: 'seed-team-1b-waitlist-1',
      name: 'Waiting Warriors',
      captainName: 'Captain Waiting',
      captainEmail: 'waiting1@poolB.com',
      captainUserId: null,
      tournamentId: tournament1.id
    }
  });

  const waitlistTeamB2 = await prisma.tournamentTeam.upsert({
    where: { id: 'seed-team-1b-waitlist-2' },
    update: {},
    create: {
      id: 'seed-team-1b-waitlist-2',
      name: 'Hopeful Heroes',
      captainName: 'Captain Hopeful',
      captainEmail: 'waiting2@poolB.com',
      captainUserId: null,
      tournamentId: tournament1.id
    }
  });

  // Add teams to waitlist
  await prisma.tournamentPoolWaitlist.upsert({
    where: { id: 'seed-waitlist-1' },
    update: {},
    create: {
      id: 'seed-waitlist-1',
      poolId: pool1B.id,
      teamId: waitlistTeamB1.id,
      position: 1
    }
  });

  await prisma.tournamentPoolWaitlist.upsert({
    where: { id: 'seed-waitlist-2' },
    update: {},
    create: {
      id: 'seed-waitlist-2',
      poolId: pool1B.id,
      teamId: waitlistTeamB2.id,
      position: 2
    }
  });

  // Create teams for Pool C (4 teams registered, 2 spots left)
  const teamNamesPoolC = [
    'Elite Eagles', 'Pro Panthers', 'Champion Chiefs', 'Victory Vipers'
  ];
  for (let i = 0; i < teamNamesPoolC.length; i++) {
    await prisma.tournamentTeam.upsert({
      where: { id: `seed-team-1c-${i}` },
      update: {},
      create: {
        id: `seed-team-1c-${i}`,
        name: teamNamesPoolC[i],
        captainName: `Captain ${teamNamesPoolC[i]}`,
        captainEmail: `captain.${i}@poolC.com`,
        captainUserId: null,
        seedNumber: i + 1,
        tournamentId: tournament1.id,
        poolId: pool1C.id,
        poolNumber: 3,
        poolName: pool1C.name,
        registrationOrder: i + 1
      }
    });
  }

  // Add some players to teams
  await prisma.tournamentPlayer.upsert({
    where: { id: 'seed-player-1' },
    update: {},
    create: {
      id: 'seed-player-1',
      teamId: 'seed-team-1a-0',
      playerName: 'Alice Guest',
      playerEmail: 'alice.guest@example.com'
    }
  });

  await prisma.tournamentPlayer.upsert({
    where: { id: 'seed-player-2' },
    update: {},
    create: {
      id: 'seed-player-2',
      teamId: 'seed-team-1a-0',
      playerName: 'John Smith',
      playerEmail: 'john.smith@example.com'
    }
  });

  await prisma.tournamentPlayer.upsert({
    where: { id: 'seed-player-3' },
    update: {},
    create: {
      id: 'seed-player-3',
      teamId: 'seed-team-1b-0',
      playerName: 'Bob Guest',
      playerEmail: 'bob.guest@example.com'
    }
  });

  console.log('Created tournament 1 teams and players');

  // Tournament 2: Basketball Tournament with 2 pools
  const tournament2 = await prisma.tournament.upsert({
    where: { id: 'seed-tournament-2' },
    update: {},
    create: {
      id: 'seed-tournament-2',
      name: 'Summer Basketball League',
      description: 'Competitive summer basketball tournament',
      sportType: 'basketball',
      format: 'single_elimination',
      status: 'registration',
      startDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
      endDate: new Date(Date.now() + 47 * 24 * 60 * 60 * 1000), // 47 days from now
      registrationStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (open)
      registrationDeadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000), // 40 days from now
      maxTeams: 16,
      location: 'Downtown Basketball Arena',
      city: 'Los Angeles',
      country: 'USA',
      latitude: 34.0522,
      longitude: -118.2437,
      locationName: 'Downtown Arena',
      organizerId: user2.id,
      groupId: group2.id,
      isPublic: true,
      allowLateRegistration: true,
      autoGenerateBrackets: true,
      prizesDescription: 'Trophies for top 3 teams',
      rulesDescription: 'NBA rules apply'
    }
  });

  // Create categories for tournament 2
  const cat2East = await prisma.tournamentCategory.upsert({
    where: { tournamentId_name: { tournamentId: tournament2.id, name: 'Eastern Division' } },
    update: {},
    create: {
      id: 'seed-cat-2-east',
      name: 'Eastern Division',
      description: 'Teams from the Eastern conference',
      sortOrder: 0,
      tournamentId: tournament2.id
    }
  });

  const cat2West = await prisma.tournamentCategory.upsert({
    where: { tournamentId_name: { tournamentId: tournament2.id, name: 'Western Division' } },
    update: {},
    create: {
      id: 'seed-cat-2-west',
      name: 'Western Division',
      description: 'Teams from the Western conference',
      sortOrder: 1,
      tournamentId: tournament2.id
    }
  });

  // Grant co_organizer role for tournament 2 to user3 (granted by user2/organizer)
  await prisma.tournamentAdminRole.upsert({
    where: { tournamentId_userId: { tournamentId: tournament2.id, userId: user3.id } },
    update: {},
    create: {
      id: 'seed-admin-role-2',
      tournamentId: tournament2.id,
      userId: user3.id,
      role: 'co_organizer',
      grantedById: user2.id
    }
  });

  // Create pools for tournament 2 (assigned to categories)
  const pool2A = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-2a' },
    update: {},
    create: {
      id: 'seed-pool-2a',
      name: 'Division A',
      description: 'Eastern division teams',
      maxTeams: 8,
      tournamentId: tournament2.id,
      categoryId: cat2East.id
    }
  });

  const pool2B = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-2b' },
    update: {},
    create: {
      id: 'seed-pool-2b',
      name: 'Division B',
      description: 'Western division teams',
      maxTeams: 8,
      tournamentId: tournament2.id,
      categoryId: cat2West.id
    }
  });

  console.log('Created tournament 2 with 2 pools and 2 categories');

  // Create teams for Pool 2A (5 teams registered)
  const teamNamesPool2A = [
    'Lakers Jr', 'Celtics Youth', 'Bulls Brigade', 'Warriors Way', 'Nets Next'
  ];
  for (let i = 0; i < teamNamesPool2A.length; i++) {
    await prisma.tournamentTeam.upsert({
      where: { id: `seed-team-2a-${i}` },
      update: {},
      create: {
        id: `seed-team-2a-${i}`,
        name: teamNamesPool2A[i],
        captainName: `Captain ${teamNamesPool2A[i]}`,
        captainEmail: `captain.${i}@pool2A.com`,
        captainUserId: null,
        seedNumber: i + 1,
        tournamentId: tournament2.id,
        poolId: pool2A.id,
        poolNumber: 1,
        poolName: pool2A.name,
        registrationOrder: i + 1
      }
    });
  }

  // Create teams for Pool 2B (6 teams registered)
  const teamNamesPool2B = [
    'Heat Wave', 'Suns Rising', 'Clippers Elite', 'Blazers Best', 'Rockets Red', 'Spurs Special'
  ];
  for (let i = 0; i < teamNamesPool2B.length; i++) {
    await prisma.tournamentTeam.upsert({
      where: { id: `seed-team-2b-${i}` },
      update: {},
      create: {
        id: `seed-team-2b-${i}`,
        name: teamNamesPool2B[i],
        captainName: `Captain ${teamNamesPool2B[i]}`,
        captainEmail: `captain.${i}@pool2B.com`,
        captainUserId: null,
        seedNumber: i + 1,
        tournamentId: tournament2.id,
        poolId: pool2B.id,
        poolNumber: 2,
        poolName: pool2B.name,
        registrationOrder: i + 1
      }
    });
  }

  console.log('Created tournament 2 teams');

  // Tournament 3: Tennis Tournament with 4 pools (different sizes)
  const tournament3 = await prisma.tournament.upsert({
    where: { id: 'seed-tournament-3' },
    update: {},
    create: {
      id: 'seed-tournament-3',
      name: 'Fall Tennis Open',
      description: 'Open tennis tournament with multiple skill categories',
      sportType: 'tennis',
      format: 'groups_knockout',
      status: 'draft',
      startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      endDate: new Date(Date.now() + 62 * 24 * 60 * 60 * 1000), // 62 days from now
      registrationDeadline: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000), // 55 days from now
      maxTeams: 20,
      location: 'City Tennis Club',
      city: 'Chicago',
      country: 'USA',
      latitude: 41.8781,
      longitude: -87.6298,
      locationName: 'City Tennis Club',
      organizerId: user3.id,
      groupId: group3.id,
      isPublic: true,
      allowLateRegistration: false,
      autoGenerateBrackets: false,
      useManualBrackets: true,
      prizesDescription: 'Cash prizes for winners',
      rulesDescription: 'ITF rules'
    }
  });

  // Create categories for tournament 3
  const cat3Singles = await prisma.tournamentCategory.upsert({
    where: { tournamentId_name: { tournamentId: tournament3.id, name: 'Singles' } },
    update: {},
    create: {
      id: 'seed-cat-3-singles',
      name: 'Singles',
      description: 'Individual singles competitions',
      sortOrder: 0,
      tournamentId: tournament3.id
    }
  });

  const cat3Doubles = await prisma.tournamentCategory.upsert({
    where: { tournamentId_name: { tournamentId: tournament3.id, name: 'Doubles' } },
    update: {},
    create: {
      id: 'seed-cat-3-doubles',
      name: 'Doubles',
      description: 'Doubles and youth competitions',
      sortOrder: 1,
      tournamentId: tournament3.id
    }
  });

  // Grant co_organizer role for tournament 3 to user4 (granted by user3/organizer)
  await prisma.tournamentAdminRole.upsert({
    where: { tournamentId_userId: { tournamentId: tournament3.id, userId: user4.id } },
    update: {},
    create: {
      id: 'seed-admin-role-3',
      tournamentId: tournament3.id,
      userId: user4.id,
      role: 'co_organizer',
      grantedById: user3.id
    }
  });

  // Create pools for tournament 3 (different sizes, assigned to categories)
  const pool3A = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-3a' },
    update: {},
    create: {
      id: 'seed-pool-3a',
      name: 'Singles - Men',
      description: 'Men singles competition',
      maxTeams: 8,
      tournamentId: tournament3.id,
      categoryId: cat3Singles.id
    }
  });

  const pool3B = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-3b' },
    update: {},
    create: {
      id: 'seed-pool-3b',
      name: 'Singles - Women',
      description: 'Women singles competition',
      maxTeams: 6,
      tournamentId: tournament3.id,
      categoryId: cat3Singles.id
    }
  });

  const pool3C = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-3c' },
    update: {},
    create: {
      id: 'seed-pool-3c',
      name: 'Doubles - Mixed',
      description: 'Mixed doubles competition',
      maxTeams: 4,
      tournamentId: tournament3.id,
      categoryId: cat3Doubles.id
    }
  });

  const pool3D = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-3d' },
    update: {},
    create: {
      id: 'seed-pool-3d',
      name: 'Youth Category',
      description: 'For players under 18',
      maxTeams: 2,
      tournamentId: tournament3.id,
      categoryId: cat3Doubles.id
    }
  });

  console.log('Created tournament 3 with 4 pools and 2 categories');

  // Create some teams for tournament 3
  await prisma.tournamentTeam.upsert({
    where: { id: 'seed-team-3a-0' },
    update: {},
    create: {
      id: 'seed-team-3a-0',
      name: 'Federer Fan',
      captainName: 'Roger Smith',
      captainEmail: 'roger@tennis.com',
      captainUserId: user1.id,
      seedNumber: 1,
      tournamentId: tournament3.id,
      poolId: pool3A.id,
      poolNumber: 1,
      poolName: pool3A.name,
      registrationOrder: 1
    }
  });

  await prisma.tournamentTeam.upsert({
    where: { id: 'seed-team-3b-0' },
    update: {},
    create: {
      id: 'seed-team-3b-0',
      name: 'Serena Sisters',
      captainName: 'Venus Williams',
      captainEmail: 'venus@tennis.com',
      captainUserId: null,
      seedNumber: 1,
      tournamentId: tournament3.id,
      poolId: pool3B.id,
      poolNumber: 2,
      poolName: pool3B.name,
      registrationOrder: 1
    }
  });

  // Full pool with waitlist for tournament 3 - Youth Category
  await prisma.tournamentTeam.upsert({
    where: { id: 'seed-team-3d-0' },
    update: {},
    create: {
      id: 'seed-team-3d-0',
      name: 'Young Guns 1',
      captainName: 'Teen Captain 1',
      captainEmail: 'teen1@tennis.com',
      captainUserId: user2.id,
      tournamentId: tournament3.id,
      poolId: pool3D.id,
      poolNumber: 4,
      poolName: pool3D.name,
      registrationOrder: 1
    }
  });

  await prisma.tournamentTeam.upsert({
    where: { id: 'seed-team-3d-1' },
    update: {},
    create: {
      id: 'seed-team-3d-1',
      name: 'Young Guns 2',
      captainName: 'Teen Captain 2',
      captainEmail: 'teen2@tennis.com',
      captainUserId: null,
      tournamentId: tournament3.id,
      poolId: pool3D.id,
      poolNumber: 4,
      poolName: pool3D.name,
      registrationOrder: 2
    }
  });

  // Add 3 teams to waitlist for Youth Category
  const waitlistYouth1 = await prisma.tournamentTeam.upsert({
    where: { id: 'seed-team-3d-wait-1' },
    update: {},
    create: {
      id: 'seed-team-3d-wait-1',
      name: 'Junior Hopefuls',
      captainName: 'Junior Captain',
      captainEmail: 'junior@tennis.com',
      captainUserId: null,
      tournamentId: tournament3.id
    }
  });

  const waitlistYouth2 = await prisma.tournamentTeam.upsert({
    where: { id: 'seed-team-3d-wait-2' },
    update: {},
    create: {
      id: 'seed-team-3d-wait-2',
      name: 'Youth Stars',
      captainName: 'Youth Captain',
      captainEmail: 'youth@tennis.com',
      captainUserId: null,
      tournamentId: tournament3.id
    }
  });

  const waitlistYouth3 = await prisma.tournamentTeam.upsert({
    where: { id: 'seed-team-3d-wait-3' },
    update: {},
    create: {
      id: 'seed-team-3d-wait-3',
      name: 'Teen Dreams',
      captainName: 'Dream Captain',
      captainEmail: 'dream@tennis.com',
      captainUserId: null,
      tournamentId: tournament3.id
    }
  });

  await prisma.tournamentPoolWaitlist.upsert({
    where: { id: 'seed-waitlist-3' },
    update: {},
    create: {
      id: 'seed-waitlist-3',
      poolId: pool3D.id,
      teamId: waitlistYouth1.id,
      position: 1
    }
  });

  await prisma.tournamentPoolWaitlist.upsert({
    where: { id: 'seed-waitlist-4' },
    update: {},
    create: {
      id: 'seed-waitlist-4',
      poolId: pool3D.id,
      teamId: waitlistYouth2.id,
      position: 2
    }
  });

  await prisma.tournamentPoolWaitlist.upsert({
    where: { id: 'seed-waitlist-5' },
    update: {},
    create: {
      id: 'seed-waitlist-5',
      poolId: pool3D.id,
      teamId: waitlistYouth3.id,
      position: 3
    }
  });

  console.log('Created tournament 3 teams and waitlists');

  // Tournament 4: Montreal Hockey Tournament (in_progress with scheduled matches)
  const tournament4 = await prisma.tournament.upsert({
    where: { id: 'seed-tournament-4' },
    update: {},
    create: {
      id: 'seed-tournament-4',
      name: 'Montreal Winter Hockey Championship',
      description: 'Annual winter hockey tournament in Montreal with multiple divisions and competitive play',
      sportType: 'iceHockey',
      format: 'groups_knockout',
      status: 'in_progress',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (already started)
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      registrationDeadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (closed)
      maxTeams: 16,
      location: 'Bell Centre',
      city: 'Montreal',
      country: 'Canada',
      latitude: 45.4960,
      longitude: -73.5693,
      locationName: 'Bell Centre, Montreal',
      organizerId: user3.id,
      groupId: group6.id,
      isPublic: true,
      allowLateRegistration: false,
      autoGenerateBrackets: false,
      useManualBrackets: true,
      prizesDescription: 'Winner: $5000 CAD, Runner-up: $2500 CAD, Third Place: $1000 CAD',
      rulesDescription: 'IIHF international ice hockey rules apply. Three 20-minute periods.'
    }
  });

  // Create categories for tournament 4 (Montreal Hockey)
  const cat4Elite = await prisma.tournamentCategory.upsert({
    where: { tournamentId_name: { tournamentId: tournament4.id, name: 'Elite' } },
    update: {},
    create: {
      id: 'seed-cat-4-elite',
      name: 'Elite',
      description: 'Top tier competitive division',
      sortOrder: 0,
      tournamentId: tournament4.id
    }
  });

  const cat4Recreational = await prisma.tournamentCategory.upsert({
    where: { tournamentId_name: { tournamentId: tournament4.id, name: 'Recreational' } },
    update: {},
    create: {
      id: 'seed-cat-4-recreational',
      name: 'Recreational',
      description: 'Recreational and youth divisions',
      sortOrder: 1,
      tournamentId: tournament4.id
    }
  });

  // Grant co_organizer role for tournament 4 to user1 (granted by user3/organizer)
  await prisma.tournamentAdminRole.upsert({
    where: { tournamentId_userId: { tournamentId: tournament4.id, userId: user1.id } },
    update: {},
    create: {
      id: 'seed-admin-role-4',
      tournamentId: tournament4.id,
      userId: user1.id,
      role: 'co_organizer',
      grantedById: user3.id
    }
  });

  // Create pools for Montreal tournament (assigned to categories)
  const pool4A = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-4a' },
    update: {},
    create: {
      id: 'seed-pool-4a',
      name: 'Pool A - Elite Division',
      description: 'Top tier teams with advanced players',
      maxTeams: 4,
      tournamentId: tournament4.id,
      categoryId: cat4Elite.id
    }
  });

  const pool4B = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-4b' },
    update: {},
    create: {
      id: 'seed-pool-4b',
      name: 'Pool B - Championship Division',
      description: 'Competitive teams with intermediate to advanced skills',
      maxTeams: 4,
      tournamentId: tournament4.id,
      categoryId: cat4Elite.id
    }
  });

  const pool4C = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-4c' },
    update: {},
    create: {
      id: 'seed-pool-4c',
      name: 'Pool C - Recreational Division',
      description: 'Fun and friendly competitive teams',
      maxTeams: 4,
      tournamentId: tournament4.id,
      categoryId: cat4Recreational.id
    }
  });

  const pool4D = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-4d' },
    update: {},
    create: {
      id: 'seed-pool-4d',
      name: 'Pool D - Youth Division',
      description: 'Teams for players under 18',
      maxTeams: 4,
      tournamentId: tournament4.id,
      categoryId: cat4Recreational.id
    }
  });

  console.log('Created Montreal tournament with 4 pools and 2 categories');

  // Create teams for Pool A (Elite Division) - 4 teams (FULL)
  const teamNamesPool4A = [
    'Montreal Canadiens Jr', 'Quebec Nordiques Legacy', 'Ottawa Senators Elite', 'Toronto Maple Leafs Youth'
  ];
  const pool4ATeams = [];
  for (let i = 0; i < teamNamesPool4A.length; i++) {
    const isCaptainAlice = false;
    const team = await prisma.tournamentTeam.upsert({
      where: { id: `seed-team-4a-${i}` },
      update: {},
      create: {
        id: `seed-team-4a-${i}`,
        name: teamNamesPool4A[i],
        captainName: `Captain ${teamNamesPool4A[i]}`,
        captainEmail: `captain.elite.${i}@montreal.hockey`,
        captainUserId: null,
        tournamentId: tournament4.id,
        poolId: pool4A.id,
        poolNumber: 1,
        poolName: pool4A.name,
        registrationOrder: i + 1
      }
    });
    pool4ATeams.push(team);
  }

  // Create teams for Pool B (Championship Division) - 4 teams (FULL)
  const teamNamesPool4B = [
    'Laval Rockets', 'Gatineau Olympiques', 'Sherbrooke Phoenix', 'Trois-Rivières Lions'
  ];
  const pool4BTeams = [];
  for (let i = 0; i < teamNamesPool4B.length; i++) {
    const team = await prisma.tournamentTeam.upsert({
      where: { id: `seed-team-4b-${i}` },
      update: {},
      create: {
        id: `seed-team-4b-${i}`,
        name: teamNamesPool4B[i],
        captainName: `Captain ${teamNamesPool4B[i]}`,
        captainEmail: `captain.championship.${i}@montreal.hockey`,
        captainUserId: null,
        tournamentId: tournament4.id,
        poolId: pool4B.id,
        poolNumber: 2,
        poolName: pool4B.name,
        registrationOrder: i + 1
      }
    });
    pool4BTeams.push(team);
  }

  // Create teams for Pool C (Recreational Division) - 4 teams (FULL)
  const teamNamesPool4C = [
    'Weekend Warriors', 'Ice Breakers', 'Puck Hogs', 'Stick Handlers'
  ];
  const pool4CTeams = [];
  for (let i = 0; i < teamNamesPool4C.length; i++) {
    const team = await prisma.tournamentTeam.upsert({
      where: { id: `seed-team-4c-${i}` },
      update: {},
      create: {
        id: `seed-team-4c-${i}`,
        name: teamNamesPool4C[i],
        captainName: `Captain ${teamNamesPool4C[i]}`,
        captainEmail: `captain.rec.${i}@montreal.hockey`,
        captainUserId: null,
        tournamentId: tournament4.id,
        poolId: pool4C.id,
        poolNumber: 3,
        poolName: pool4C.name,
        registrationOrder: i + 1
      }
    });
    pool4CTeams.push(team);
  }

  // Create teams for Pool D (Youth Division) - 4 teams (FULL)
  const teamNamesPool4D = [
    'Young Guns', 'Future Stars', 'Junior Aces', 'Youth Thunder'
  ];
  const pool4DTeams = [];
  for (let i = 0; i < teamNamesPool4D.length; i++) {
    const team = await prisma.tournamentTeam.upsert({
      where: { id: `seed-team-4d-${i}` },
      update: {},
      create: {
        id: `seed-team-4d-${i}`,
        name: teamNamesPool4D[i],
        captainName: `Captain ${teamNamesPool4D[i]}`,
        captainEmail: `captain.youth.${i}@montreal.hockey`,
        captainUserId: null,
        tournamentId: tournament4.id,
        poolId: pool4D.id,
        poolNumber: 4,
        poolName: pool4D.name,
        registrationOrder: i + 1
      }
    });
    pool4DTeams.push(team);
  }

  // Add players to some teams
  await prisma.tournamentPlayer.upsert({
    where: { id: 'seed-player-4-1' },
    update: {},
    create: {
      id: 'seed-player-4-1',
      teamId: pool4ATeams[0].id,
      playerName: 'Alice Guest',
      playerEmail: 'alice.guest@montreal.hockey'
    }
  });

  await prisma.tournamentPlayer.upsert({
    where: { id: 'seed-player-4-2' },
    update: {},
    create: {
      id: 'seed-player-4-2',
      teamId: pool4ATeams[0].id,
      playerName: 'Marc Johnson',
      playerEmail: 'marc.johnson@montreal.hockey'
    }
  });

  await prisma.tournamentPlayer.upsert({
    where: { id: 'seed-player-4-3' },
    update: {},
    create: {
      id: 'seed-player-4-3',
      teamId: pool4ATeams[0].id,
      playerName: 'Charlie Guest',
      playerEmail: 'charlie.guest@montreal.hockey'
    }
  });

  await prisma.tournamentPlayer.upsert({
    where: { id: 'seed-player-4-4' },
    update: {},
    create: {
      id: 'seed-player-4-4',
      teamId: pool4BTeams[0].id,
      userId: user2.id,
      playerName: 'Bob',
      playerEmail: user2.email
    }
  });

  await prisma.tournamentPlayer.upsert({
    where: { id: 'seed-player-4-5' },
    update: {},
    create: {
      id: 'seed-player-4-5',
      teamId: pool4BTeams[1].id,
      userId: user4.id,
      playerName: 'Diana',
      playerEmail: user4.email
    }
  });

  await prisma.tournamentTeamInvitation.upsert({
    where: { id: 'seed-team-invitation-1' },
    update: {},
    create: {
      id: 'seed-team-invitation-1',
      teamId: pool4ATeams[0].id,
      inviteeEmail: user4.email,
      inviteeName: user4.name,
      inviteeUserId: user4.id,
      inviterId: user1.id,
      inviteToken: 'seed-team-invite-token-1',
      status: 'pending',
      message: 'Join our elite hockey roster for the playoffs.',
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    }
  });

  // Create matches for Pool A with different timestamps
  const baseDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // yesterday (tournament in progress)
  
  // Pool A Match 1: Day 1, 10:00 AM
  await prisma.tournamentMatch.upsert({
    where: { id: 'seed-match-4a-1' },
    update: {},
    create: {
      id: 'seed-match-4a-1',
      tournamentId: tournament4.id,
      homeTeamId: pool4ATeams[0].id,
      awayTeamId: pool4ATeams[1].id,
      stage: 'group_stage',
      roundNumber: 1,
      groupName: pool4A.name,
      status: 'scheduled',
      scheduledAt: new Date(baseDate.getTime() + 10 * 60 * 60 * 1000), // 10:00 AM
      matchOrder: 1
    }
  });

  // Pool A Match 2: Day 1, 2:00 PM
  await prisma.tournamentMatch.upsert({
    where: { id: 'seed-match-4a-2' },
    update: {},
    create: {
      id: 'seed-match-4a-2',
      tournamentId: tournament4.id,
      homeTeamId: pool4ATeams[2].id,
      awayTeamId: pool4ATeams[3].id,
      stage: 'group_stage',
      roundNumber: 1,
      groupName: pool4A.name,
      status: 'scheduled',
      scheduledAt: new Date(baseDate.getTime() + 14 * 60 * 60 * 1000), // 2:00 PM
      matchOrder: 2
    }
  });

  // Pool A Match 3: Day 2, 11:00 AM
  await prisma.tournamentMatch.upsert({
    where: { id: 'seed-match-4a-3' },
    update: {},
    create: {
      id: 'seed-match-4a-3',
      tournamentId: tournament4.id,
      homeTeamId: pool4ATeams[0].id,
      awayTeamId: pool4ATeams[2].id,
      refereeTeamId: pool4ATeams[1].id, // Team on break acts as referee
      stage: 'group_stage',
      roundNumber: 2,
      groupName: pool4A.name,
      status: 'scheduled',
      scheduledAt: new Date(baseDate.getTime() + 25 * 60 * 60 * 1000), // Day 2, 11:00 AM
      matchOrder: 3
    }
  });

  // Pool A Match 4: Day 2, 3:00 PM
  await prisma.tournamentMatch.upsert({
    where: { id: 'seed-match-4a-4' },
    update: {},
    create: {
      id: 'seed-match-4a-4',
      tournamentId: tournament4.id,
      homeTeamId: pool4ATeams[1].id,
      awayTeamId: pool4ATeams[3].id,
      refereeTeamId: pool4ATeams[2].id,
      stage: 'group_stage',
      roundNumber: 2,
      groupName: pool4A.name,
      status: 'scheduled',
      scheduledAt: new Date(baseDate.getTime() + 29 * 60 * 60 * 1000), // Day 2, 3:00 PM
      matchOrder: 4
    }
  });

  // Pool A Match 5: Day 3, 12:00 PM (with scores - completed)
  await prisma.tournamentMatch.upsert({
    where: { id: 'seed-match-4a-5' },
    update: {},
    create: {
      id: 'seed-match-4a-5',
      tournamentId: tournament4.id,
      homeTeamId: pool4ATeams[0].id,
      awayTeamId: pool4ATeams[3].id,
      refereeTeamId: pool4ATeams[1].id,
      homeScore: 4,
      awayScore: 2,
      stage: 'group_stage',
      roundNumber: 3,
      groupName: pool4A.name,
      status: 'completed',
      scheduledAt: new Date(baseDate.getTime() + 50 * 60 * 60 * 1000), // Day 3, 12:00 PM
      startedAt: new Date(baseDate.getTime() + 50 * 60 * 60 * 1000),
      completedAt: new Date(baseDate.getTime() + 52 * 60 * 60 * 1000),
      matchOrder: 5
    }
  });

  // Pool A Match 6: Day 3, 4:00 PM
  await prisma.tournamentMatch.upsert({
    where: { id: 'seed-match-4a-6' },
    update: {},
    create: {
      id: 'seed-match-4a-6',
      tournamentId: tournament4.id,
      homeTeamId: pool4ATeams[1].id,
      awayTeamId: pool4ATeams[2].id,
      refereeTeamId: pool4ATeams[3].id,
      stage: 'group_stage',
      roundNumber: 3,
      groupName: pool4A.name,
      status: 'scheduled',
      scheduledAt: new Date(baseDate.getTime() + 54 * 60 * 60 * 1000), // Day 3, 4:00 PM
      matchOrder: 6
    }
  });

  // Create matches for Pool B
  // Pool B Match 1: Day 1, 11:30 AM
  await prisma.tournamentMatch.upsert({
    where: { id: 'seed-match-4b-1' },
    update: {},
    create: {
      id: 'seed-match-4b-1',
      tournamentId: tournament4.id,
      homeTeamId: pool4BTeams[0].id,
      awayTeamId: pool4BTeams[1].id,
      stage: 'group_stage',
      roundNumber: 1,
      groupName: pool4B.name,
      status: 'scheduled',
      scheduledAt: new Date(baseDate.getTime() + 11.5 * 60 * 60 * 1000), // 11:30 AM
      matchOrder: 1
    }
  });

  // Pool B Match 2: Day 1, 3:30 PM
  await prisma.tournamentMatch.upsert({
    where: { id: 'seed-match-4b-2' },
    update: {},
    create: {
      id: 'seed-match-4b-2',
      tournamentId: tournament4.id,
      homeTeamId: pool4BTeams[2].id,
      awayTeamId: pool4BTeams[3].id,
      stage: 'group_stage',
      roundNumber: 1,
      groupName: pool4B.name,
      status: 'scheduled',
      scheduledAt: new Date(baseDate.getTime() + 15.5 * 60 * 60 * 1000), // 3:30 PM
      matchOrder: 2
    }
  });

  // Pool B Match 3: Day 2, 12:30 PM
  await prisma.tournamentMatch.upsert({
    where: { id: 'seed-match-4b-3' },
    update: {},
    create: {
      id: 'seed-match-4b-3',
      tournamentId: tournament4.id,
      homeTeamId: pool4BTeams[0].id,
      awayTeamId: pool4BTeams[2].id,
      stage: 'group_stage',
      roundNumber: 2,
      groupName: pool4B.name,
      status: 'scheduled',
      scheduledAt: new Date(baseDate.getTime() + 26.5 * 60 * 60 * 1000), // Day 2, 12:30 PM
      matchOrder: 3
    }
  });

  // Create standings for Pool A teams
  await prisma.tournamentStanding.upsert({
    where: { id: 'seed-standing-4a-1' },
    update: {},
    create: {
      id: 'seed-standing-4a-1',
      tournamentId: tournament4.id,
      teamId: pool4ATeams[0].id,
      points: 3,
      wins: 1,
      losses: 0,
      draws: 0,
      goalsFor: 4,
      goalsAgainst: 2,
      groupName: pool4A.name
    }
  });

  await prisma.tournamentStanding.upsert({
    where: { id: 'seed-standing-4a-2' },
    update: {},
    create: {
      id: 'seed-standing-4a-2',
      tournamentId: tournament4.id,
      teamId: pool4ATeams[1].id,
      points: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      groupName: pool4A.name
    }
  });

  await prisma.tournamentStanding.upsert({
    where: { id: 'seed-standing-4a-3' },
    update: {},
    create: {
      id: 'seed-standing-4a-3',
      tournamentId: tournament4.id,
      teamId: pool4ATeams[2].id,
      points: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      groupName: pool4A.name
    }
  });

  await prisma.tournamentStanding.upsert({
    where: { id: 'seed-standing-4a-4' },
    update: {},
    create: {
      id: 'seed-standing-4a-4',
      tournamentId: tournament4.id,
      teamId: pool4ATeams[3].id,
      points: 0,
      wins: 0,
      losses: 1,
      draws: 0,
      goalsFor: 2,
      goalsAgainst: 4,
      groupName: pool4A.name
    }
  });

  // Create standings for Pool B teams (all zeros - no matches completed yet)
  for (let i = 0; i < pool4BTeams.length; i++) {
    await prisma.tournamentStanding.upsert({
      where: { id: `seed-standing-4b-${i + 1}` },
      update: {},
      create: {
        id: `seed-standing-4b-${i + 1}`,
        tournamentId: tournament4.id,
        teamId: pool4BTeams[i].id,
        points: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        groupName: pool4B.name
      }
    });
  }

  // Create standings for Pool C teams
  for (let i = 0; i < pool4CTeams.length; i++) {
    await prisma.tournamentStanding.upsert({
      where: { id: `seed-standing-4c-${i + 1}` },
      update: {},
      create: {
        id: `seed-standing-4c-${i + 1}`,
        tournamentId: tournament4.id,
        teamId: pool4CTeams[i].id,
        points: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        groupName: pool4C.name
      }
    });
  }

  // Create standings for Pool D teams
  for (let i = 0; i < pool4DTeams.length; i++) {
    await prisma.tournamentStanding.upsert({
      where: { id: `seed-standing-4d-${i + 1}` },
      update: {},
      create: {
        id: `seed-standing-4d-${i + 1}`,
        tournamentId: tournament4.id,
        teamId: pool4DTeams[i].id,
        points: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        groupName: pool4D.name
      }
    });
  }

  console.log('Created Montreal tournament with teams, matches, and standings');

  // Create tournament notifications (new model) — moved here so tournaments exist
  console.log('\nSeeding tournament notifications...');
  await prisma.tournamentNotification.upsert({
    where: { id: 'seed-tournament-notif-1' },
    update: {},
    create: {
      id: 'seed-tournament-notif-1',
      tournamentId: tournament1.id,
      userId: user2.id,
      type: 'team_registered',
      params: { tournamentName: tournament1.name, teamName: 'Thunder Strikers' },
      metadata: { teamId: 'seed-team-1a-0' },
      read: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.tournamentNotification.upsert({
    where: { id: 'seed-tournament-notif-2' },
    update: {},
    create: {
      id: 'seed-tournament-notif-2',
      tournamentId: tournament2.id,
      userId: user1.id,
      type: 'tournament_updated',
      params: { tournamentName: tournament2.name },
      metadata: { updatedFields: ['registrationDeadline'] },
      read: false,
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000)
    }
  });

  await prisma.tournamentNotification.upsert({
    where: { id: 'seed-tournament-notif-3' },
    update: {},
    create: {
      id: 'seed-tournament-notif-3',
      tournamentId: tournament4.id,
      userId: user3.id,
      type: 'match_scheduled',
      params: { tournamentName: tournament4.name, matchId: 'seed-match-4a-1' },
      metadata: { scheduledAt: new Date() },
      read: false,
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
    }
  });

  await validateTournamentSeedIntegrity([
    tournament1.id,
    tournament2.id,
    tournament3.id,
    tournament4.id,
  ]);

  console.log('\n========================================');
  console.log('Seeding completed successfully!');
  console.log('========================================');
  console.log('Summary (for display purposes only - counts may vary):');
  console.log('- Users: 4');
  console.log('- Groups: 6 (5 public, 1 private)');
  console.log('  - 2 groups in Sherbrooke, QC (Alice is NOT a member)');
  console.log('  - 1 group in Montreal, QC (Charlie as admin)');
  console.log('- Sessions: 10 (across all groups)');
  console.log('- Group Notifications: 3');
  console.log('- Session Notifications: 6');
  console.log('- Session Requests: 4');
  console.log('- Session Votes: 7');
  console.log('- Group Join Requests: 2');
  console.log('- Invite Logs: 2');
  console.log('- Session Attendance Records: 3');
  console.log('- Group Bans: 1');
  console.log('- Audit Logs: 3');
  console.log('- TeamUp Requests: 5 (3 need_players, 2 looking_for_play)');
  console.log('- TeamUp Responses: 4');
  console.log('- TeamUp Notifications: 5');
  console.log('- Session Reminders: 3');
  console.log('- Session Comments: 4');
  console.log('- Guest Participants: 8');
  console.log('- Tournament Team Invitations: 1');
  console.log('- Tournaments: 4 (3 upcoming/draft, 1 in progress)');
  console.log('  - Montreal Winter Hockey Championship (in_progress) with 4 pools and scheduled matches');
  console.log('- Tournament Categories: 11 (across all 4 tournaments)');
  console.log('- Tournament Admin Roles: 4 (1 co_organizer per tournament)');
  console.log('- Tournament Pools: 13 (with categories assigned and varying team capacities)');
  console.log('- Tournament Teams: 46+');
  console.log('- Tournament Matches: 9+ (with different timestamps and referee assignments)');
  console.log('- Waitlist Entries: 5 (across multiple pools)');
  console.log('- Tournament Players: 8+');
  console.log('- Tournament Standings: 16+ (with stats)');
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
