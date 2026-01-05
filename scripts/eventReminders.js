// scripts/eventReminders.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');

// Configure your email transport
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEventReminders() {
  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

  // Find events starting within the next hour
  const events = await prisma.event.findMany({
    where: {
      startTime: {
        gte: now,
        lte: soon,
      },
    },
    include: {
      participants: true,
    },
  });

  for (const event of events) {
    for (const participant of event.participants) {
      // Check if reminder already sent
      const exists = await prisma.eventNotification.findFirst({
        where: {
          eventId: event.id,
          userId: participant.userId,
          type: 'reminder',
        },
      });
      if (!exists) {
        await prisma.eventNotification.create({
          data: {
            eventId: event.id,
            userId: participant.userId,
            type: 'reminder',
          },
        });
      }
    }
  }
}

sendEventReminders().then(() => {
  console.log('Event reminders processed');
  process.exit(0);
});
