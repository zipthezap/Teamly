import prisma from '../config/database';
import { sendEmail } from '../utils/emailService';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError, NotFoundError } from '../utils/errors';
import * as authService from '../services/authService';
import { UpdateEmailPreferenceData } from '../../shared/types/email.types';
import { AuthenticatedRequest, RouteParams } from '../types/controller.types';

// Get user email preferences
export const getEmailPreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
  let preferences = await prisma.emailPreference.findUnique({
    where: { userId: req.user.id }
  });

  // Create default preferences if they don't exist
  if (!preferences) {
    preferences = await prisma.emailPreference.create({
      data: { userId: req.user.id }
    });
  }

  res.json(preferences);
});

// Update user email preferences
export const updateEmailPreferences = asyncHandler(async (req: AuthenticatedRequest<UpdateEmailPreferenceData>, res: Response) => {
  const data = req.body;

  const preferences = await prisma.emailPreference.upsert({
    where: { userId: req.user.id },
    update: {
      ...(data.eventInvites !== undefined && { eventInvites: data.eventInvites }),
      ...(data.eventReminders !== undefined && { eventReminders: data.eventReminders }),
      ...(data.eventUpdates !== undefined && { eventUpdates: data.eventUpdates }),
      ...(data.eventCancellations !== undefined && { eventCancellations: data.eventCancellations }),
      ...(data.groupInvites !== undefined && { groupInvites: data.groupInvites }),
      ...(data.commentMentions !== undefined && { commentMentions: data.commentMentions }),
      ...(data.nearbyTeamUps !== undefined && { nearbyTeamUps: data.nearbyTeamUps }),
      ...(data.muteEventInvites !== undefined && { muteEventInvites: data.muteEventInvites }),
      ...(data.muteEventReminders !== undefined && { muteEventReminders: data.muteEventReminders }),
      ...(data.muteEventUpdates !== undefined && { muteEventUpdates: data.muteEventUpdates }),
      ...(data.muteEventCancellations !== undefined && { muteEventCancellations: data.muteEventCancellations }),
      ...(data.muteGroupInvites !== undefined && { muteGroupInvites: data.muteGroupInvites }),
      ...(data.muteGroupRequests !== undefined && { muteGroupRequests: data.muteGroupRequests }),
      ...(data.muteNearbyGroups !== undefined && { muteNearbyGroups: data.muteNearbyGroups }),
      ...(data.muteEventCreated !== undefined && { muteEventCreated: data.muteEventCreated }),
      ...(data.muteNearbyTeamUps !== undefined && { muteNearbyTeamUps: data.muteNearbyTeamUps })
    },
    create: {
      userId: req.user.id,
      eventInvites: data.eventInvites ?? true,
      eventReminders: data.eventReminders ?? true,
      eventUpdates: data.eventUpdates ?? true,
      eventCancellations: data.eventCancellations ?? true,
      groupInvites: data.groupInvites ?? true,
      commentMentions: data.commentMentions ?? true,
      nearbyTeamUps: data.nearbyTeamUps ?? true,
      muteEventInvites: data.muteEventInvites ?? false,
      muteEventReminders: data.muteEventReminders ?? false,
      muteEventUpdates: data.muteEventUpdates ?? false,
      muteEventCancellations: data.muteEventCancellations ?? false,
      muteGroupInvites: data.muteGroupInvites ?? false,
      muteGroupRequests: data.muteGroupRequests ?? false,
      muteNearbyGroups: data.muteNearbyGroups ?? false,
      muteEventCreated: data.muteEventCreated ?? false,
      muteNearbyTeamUps: data.muteNearbyTeamUps ?? false
    }
  });

  res.json(preferences);
});

// Send email verification
export const sendVerificationEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
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
    where: { id: req.user.id },
    data: { emailVerificationToken: hashedToken }
  });

  // Send verification email with plain token
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email/${token}`;
  await sendEmail(user.email, 'emailVerification', user.name, verificationUrl);

  res.json({ message: 'Verification email sent' });
});

// Verify email
export const verifyEmail = asyncHandler(async (req: Request<RouteParams<'token'>>, res: Response) => {
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

interface ToggleEmailBody {
  enabled: boolean;
}

// Toggle email notifications on/off
export const toggleEmailNotifications = asyncHandler(async (req: AuthenticatedRequest<ToggleEmailBody>, res: Response) => {
  const { enabled } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { emailNotifications: enabled }
  });

  res.json({ emailNotifications: user.emailNotifications });
});

