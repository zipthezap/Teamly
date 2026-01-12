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

async function main() {
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

  // Create multiple events across different groups
  const events = [
    // Group 1 (Alice's Sports Club) events
    {
      id: 'seed-event-alice-group-football',
      title: 'Weekend Football Match',
      description: 'Join us for a friendly football match this weekend!',
      eventType: 'football',
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
    {
      id: 'seed-event-alice-group-tennis',
      title: 'Tennis Doubles Tournament',
      description: 'Compete in our tennis doubles tournament!',
      eventType: 'tennis',
      location: 'Riverside Tennis Courts',
      city: 'New York',
      country: 'USA',
      latitude: 40.7589,
      longitude: -73.9851,
      locationName: 'Riverside Courts',
      startTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // 3 hours duration
      maxPlayers: 16,
      isPublic: true,
      status: 'upcoming',
      creatorId: user2.id,
      groupId: group1.id,
      participants: [
        { userId: user2.id, status: 'confirmed' },
        { userId: user3.id, status: 'confirmed' }
      ]
    },
    {
      id: 'seed-event-alice-group-past',
      title: 'Morning Yoga Session',
      description: 'Relaxing morning yoga session at the park',
      eventType: 'other',
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
      id: 'seed-event-bob-group-basketball-1',
      title: 'Basketball Pickup Game',
      description: 'Join us for a casual basketball game!',
      eventType: 'basketball',
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
      id: 'seed-event-bob-group-basketball-2',
      title: 'Championship Game',
      description: 'Final championship game of the season!',
      eventType: 'basketball',
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
      id: 'seed-event-charlie-group-tennis',
      title: 'Private Tennis Clinic',
      description: 'Members-only tennis coaching session',
      eventType: 'tennis',
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
    const event = await prisma.event.upsert({
      where: { id: eventData.id },
      update: {},
      create: {
        ...eventData,
        participants: {
          create: eventData.participants
        }
      }
    });
    createdEvents.push(event);
    console.log('Seeded event:', eventData.title);
  }

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
  await prisma.eventNotification.upsert({
    where: { id: 'seed-event-notif-1' },
    update: {},
    create: {
      id: 'seed-event-notif-1',
      eventId: createdEvents[0].id,
      userId: user1.id,
      type: 'join',
      params: { userName: 'Bob', eventTitle: createdEvents[0].title },
      metadata: { status: 'confirmed' },
      read: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    }
  });

  await prisma.eventNotification.upsert({
    where: { id: 'seed-event-notif-2' },
    update: {},
    create: {
      id: 'seed-event-notif-2',
      eventId: createdEvents[0].id,
      userId: user2.id,
      type: 'confirmed',
      params: { userName: 'Charlie', eventTitle: createdEvents[0].title },
      metadata: { previousStatus: 'pending', newStatus: 'confirmed' },
      read: true,
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
    }
  });

  await prisma.eventNotification.upsert({
    where: { id: 'seed-event-notif-3' },
    update: {},
    create: {
      id: 'seed-event-notif-3',
      eventId: createdEvents[1].id,
      userId: user3.id,
      type: 'late',
      params: { userName: 'Bob', eventTitle: createdEvents[1].title },
      metadata: { minutesLate: 15 },
      read: false,
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
    }
  });

  await prisma.eventNotification.upsert({
    where: { id: 'seed-event-notif-4' },
    update: {},
    create: {
      id: 'seed-event-notif-4',
      eventId: createdEvents[3].id,
      userId: user1.id,
      type: 'status_change',
      params: { eventTitle: createdEvents[3].title, newStatus: 'confirmed' },
      metadata: { changedBy: 'Bob' },
      read: false,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
    }
  });
  console.log('Seeded 4 event notifications');

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
  console.log('Seeded 3 TeamUp requests');

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
  await prisma.eventReminder.upsert({
    where: { id: 'seed-reminder-1' },
    update: {},
    create: {
      id: 'seed-reminder-1',
      eventId: createdEvents[0].id,
      userId: user1.id,
      remindAt: new Date(createdEvents[0].startTime.getTime() - 24 * 60 * 60 * 1000), // 24 hours before
      sent: false
    }
  });

  await prisma.eventReminder.upsert({
    where: { id: 'seed-reminder-2' },
    update: {},
    create: {
      id: 'seed-reminder-2',
      eventId: createdEvents[0].id,
      userId: user2.id,
      remindAt: new Date(createdEvents[0].startTime.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
      sent: false
    }
  });

  await prisma.eventReminder.upsert({
    where: { id: 'seed-reminder-3' },
    update: {},
    create: {
      id: 'seed-reminder-3',
      eventId: createdEvents[2].id, // Past event
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
      eventId: createdEvents[0].id,
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
      eventId: createdEvents[0].id,
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
      eventId: createdEvents[3].id,
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
      eventId: createdEvents[3].id,
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
      eventId: createdEvents[0].id,
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
      eventId: createdEvents[0].id,
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
      eventId: createdEvents[3].id,
      name: 'Mike Johnson',
      status: 'confirmed',
      joinedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    }
  });
  console.log('Seeded 3 guest participants');

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

  // Create pools for tournament 1
  const pool1A = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-1a' },
    update: {},
    create: {
      id: 'seed-pool-1a',
      name: 'Pool A - Beginners',
      description: 'For teams new to competitive football',
      maxTeams: 8,
      tournamentId: tournament1.id
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
      tournamentId: tournament1.id
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
      tournamentId: tournament1.id
    }
  });

  console.log('Created tournament 1 with 3 pools');

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
        captainUserId: [user1.id, user2.id, user3.id, user4.id][i % 4],
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
        captainUserId: [user1.id, user2.id, user3.id, user4.id][i % 4],
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
      captainUserId: user1.id,
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
      captainUserId: user2.id,
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
        captainUserId: [user1.id, user2.id, user3.id, user4.id][i % 4],
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
      userId: user1.id,
      playerName: 'Alice',
      playerEmail: user1.email
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
      userId: user2.id,
      playerName: 'Bob',
      playerEmail: user2.email
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

  // Create pools for tournament 2
  const pool2A = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-2a' },
    update: {},
    create: {
      id: 'seed-pool-2a',
      name: 'Division A',
      description: 'Eastern division teams',
      maxTeams: 8,
      tournamentId: tournament2.id
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
      tournamentId: tournament2.id
    }
  });

  console.log('Created tournament 2 with 2 pools');

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
        captainUserId: [user1.id, user2.id, user3.id, user4.id][i % 4],
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
        captainUserId: [user1.id, user2.id, user3.id, user4.id][i % 4],
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

  // Create pools for tournament 3 (different sizes)
  const pool3A = await prisma.tournamentPool.upsert({
    where: { id: 'seed-pool-3a' },
    update: {},
    create: {
      id: 'seed-pool-3a',
      name: 'Singles - Men',
      description: 'Men singles competition',
      maxTeams: 8,
      tournamentId: tournament3.id
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
      tournamentId: tournament3.id
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
      tournamentId: tournament3.id
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
      tournamentId: tournament3.id
    }
  });

  console.log('Created tournament 3 with 4 pools of different sizes');

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
      captainUserId: user4.id,
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
      captainUserId: user3.id,
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
      captainUserId: user1.id,
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
      captainUserId: user2.id,
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
      captainUserId: user3.id,
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

  console.log('\n========================================');
  console.log('Seeding completed successfully!');
  console.log('========================================');
  console.log('Summary:');
  console.log('- Users: 4');
  console.log('- Groups: 3 (2 public, 1 private)');
  console.log('- Events: 7 (across all groups)');
  console.log('- Group Notifications: 3');
  console.log('- Event Notifications: 4');
  console.log('- TeamUp Requests: 3');
  console.log('- TeamUp Responses: 4');
  console.log('- TeamUp Notifications: 5');
  console.log('- Event Reminders: 3');
  console.log('- Event Comments: 4');
  console.log('- Guest Participants: 3');
  console.log('- Tournaments: 3 (upcoming only)');
  console.log('- Tournament Pools: 9 (with varying team capacities)');
  console.log('- Tournament Teams: 30+');
  console.log('- Waitlist Entries: 5 (across multiple pools)');
  console.log('- Tournament Players: 3+');
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
