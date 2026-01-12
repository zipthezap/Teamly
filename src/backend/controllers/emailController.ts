import prisma from '../config/database';
import { sendEmail } from '../utils/emailService';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError, NotFoundError } from '../utils/errors';
import * as authService from '../services/authService';

// Get user email preferences
export const getEmailPreferences = asyncHandler(async (req: Request, res: Response) => {
  let preferences = await prisma.emailPreference.findUnique({
    where: { userId: (req.user as any).id }
  });

  // Create default preferences if they don't exist
  if (!preferences) {
    preferences = await prisma.emailPreference.create({
      data: { userId: (req.user as any).id }
    });
  }

  res.json(preferences);
});

// Update user email preferences
export const updateEmailPreferences = asyncHandler(async (req: Request, res: Response) => {
  const {
    eventInvites,
    eventReminders,
    eventUpdates,
    eventCancellations,
    groupInvites,
    commentMentions
  } = req.body;

  const preferences = await prisma.emailPreference.upsert({
    where: { userId: (req.user as any).id },
    update: {
      eventInvites: eventInvites !== undefined ? eventInvites : undefined,
      eventReminders: eventReminders !== undefined ? eventReminders : undefined,
      eventUpdates: eventUpdates !== undefined ? eventUpdates : undefined,
      eventCancellations: eventCancellations !== undefined ? eventCancellations : undefined,
      groupInvites: groupInvites !== undefined ? groupInvites : undefined,
      commentMentions: commentMentions !== undefined ? commentMentions : undefined
    },
    create: {
      userId: (req.user as any).id,
      eventInvites: eventInvites !== undefined ? eventInvites : true,
      eventReminders: eventReminders !== undefined ? eventReminders : true,
      eventUpdates: eventUpdates !== undefined ? eventUpdates : true,
      eventCancellations: eventCancellations !== undefined ? eventCancellations : true,
      groupInvites: groupInvites !== undefined ? groupInvites : true,
      commentMentions: commentMentions !== undefined ? commentMentions : true
    }
  });

  res.json(preferences);
});

// Send email verification
export const sendVerificationEmail = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: (req.user as any).id }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.emailVerified) {
    throw new BadRequestError('Email already verified');
  }

  // Generate verification token (returns plain and hashed versions)
  const { token, hashedToken } = authService.generateEmailVerificationToken();

  // Update user with hashed token
  await prisma.user.update({
    where: { id: (req.user as any).id },
    data: { emailVerificationToken: hashedToken }
  });

  // Send verification email with plain token
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email/${token}`;
  await sendEmail(user.email, 'emailVerification', user.name, verificationUrl);

  res.json({ message: 'Verification email sent' });
});

// Verify email
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  // Hash the token to compare with stored hash
  const hashedToken = authService.hashToken(token);

  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: hashedToken }
  });

  if (!user) {
    throw new BadRequestError('Invalid or expired verification token');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null
    }
  });

  res.json({ message: 'Email verified successfully' });
});

// Toggle email notifications on/off
export const toggleEmailNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { enabled } = req.body;

  const user = await prisma.user.update({
    where: { id: (req.user as any).id },
    data: { emailNotifications: enabled }
  });

  res.json({ emailNotifications: user.emailNotifications });
});

