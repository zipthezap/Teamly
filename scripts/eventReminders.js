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

async function sendReminders() {
  // Find reminders that are due and not sent
  const now = new Date();
  const reminders = await prisma.eventReminder.findMany({
    where: {
      remindAt: { lte: now },
      sent: false,
    },
    include: { user: true, event: true },
  });

  for (const reminder of reminders) {
    if (!reminder.user.email) continue;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: reminder.user.email,
      subject: `Reminder: Upcoming Event ${reminder.event.title}`,
      text: `Hi ${reminder.user.name},\n\nThis is a reminder for your upcoming event: ${reminder.event.title} at ${reminder.event.startTime}.\n\nTeamly`,
    });
    await prisma.eventReminder.update({ where: { id: reminder.id }, data: { sent: true } });
  }
}

sendReminders().then(() => process.exit(0));
