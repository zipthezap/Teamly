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
      eventType: 'yoga',
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
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
