import nodemailer from 'nodemailer';
import { logger } from './logger';
import { escapeHtml, validateNoCRLF } from './validation';

// Create email transporter
const createTransporter = () => {
  // For development, use ethereal email (test account)
  // In production, configure with SendGrid, AWS SES, or other service
  if (process.env.EMAIL_SERVICE === 'sendgrid') {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  } else if (process.env.EMAIL_SERVICE === 'ses') {
    return nodemailer.createTransport({
      host: process.env.AWS_SES_HOST || 'email-smtp.us-east-1.amazonaws.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.AWS_SES_USER,
        pass: process.env.AWS_SES_PASSWORD
      }
    });
  } else {
    // Default: Use SMTP settings from environment
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      } : undefined
    });
  }
};

// Email templates with HTML escaping for security
export const emailTemplates = {
  eventInvitation: (userName: string, eventTitle: string, eventDate: string | Date, groupName: string) => ({
    subject: `You're invited to ${eventTitle}`,
    html: `
      <h2>Hi ${escapeHtml(userName)},</h2>
      <p>You've been invited to join an event in ${escapeHtml(groupName)}:</p>
      <h3>${escapeHtml(eventTitle)}</h3>
      <p><strong>Date:</strong> ${new Date(eventDate).toLocaleString()}</p>
      <p>Log in to Teamly to confirm your participation.</p>
    `
  }),

  eventUpdate: (userName: string, eventTitle: string, groupName: string) => ({
    subject: `Event Updated: ${eventTitle}`,
    html: `
      <h2>Hi ${escapeHtml(userName)},</h2>
      <p>An event in ${escapeHtml(groupName)} has been updated:</p>
      <h3>${escapeHtml(eventTitle)}</h3>
      <p>Log in to Teamly to view the latest details.</p>
    `
  }),

  eventCancellation: (userName: string, eventTitle: string, groupName: string) => ({
    subject: `Event Cancelled: ${eventTitle}`,
    html: `
      <h2>Hi ${escapeHtml(userName)},</h2>
      <p>Unfortunately, an event in ${escapeHtml(groupName)} has been cancelled:</p>
      <h3>${escapeHtml(eventTitle)}</h3>
      <p>Please check Teamly for more information.</p>
    `
  }),

  eventReminder: (userName: string, eventTitle: string, eventDate: string | Date, location: string) => ({
    subject: `Reminder: ${eventTitle} is coming up soon`,
    html: `
      <h2>Hi ${escapeHtml(userName)},</h2>
      <p>This is a reminder that you have an event coming up:</p>
      <h3>${escapeHtml(eventTitle)}</h3>
      <p><strong>Date:</strong> ${new Date(eventDate).toLocaleString()}</p>
      ${location ? `<p><strong>Location:</strong> ${escapeHtml(location)}</p>` : ''}
      <p>See you there!</p>
    `
  }),

  groupInvitation: (userName: string, groupName: string, inviterName: string) => ({
    subject: `You've been invited to join ${groupName}`,
    html: `
      <h2>Hi ${escapeHtml(userName)},</h2>
      <p>${escapeHtml(inviterName)} has invited you to join their group:</p>
      <h3>${escapeHtml(groupName)}</h3>
      <p>Log in to Teamly to accept the invitation.</p>
    `
  }),

  commentMention: (userName: string, commenterName: string, eventTitle: string, commentContent: string) => ({
    subject: `${commenterName} mentioned you in a comment`,
    html: `
      <h2>Hi ${escapeHtml(userName)},</h2>
      <p>${escapeHtml(commenterName)} mentioned you in a comment on <strong>${escapeHtml(eventTitle)}</strong>:</p>
      <blockquote>${escapeHtml(commentContent)}</blockquote>
      <p>Log in to Teamly to view and reply.</p>
    `
  }),

  emailVerification: (userName: string, verificationUrl: string) => ({
    subject: 'Verify your email address',
    html: `
      <h2>Hi ${escapeHtml(userName)},</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${escapeHtml(verificationUrl)}">Verify Email</a>
      <p>If you didn't create a Teamly account, you can safely ignore this email.</p>
    `
  }),

  tournamentTeamInvitation: (inviteeName: string, inviterName: string, teamName: string, tournamentName: string, inviteUrl: string, message: string) => ({
    subject: `You're invited to join ${teamName} in ${tournamentName}`,
    html: `
      <h2>Hi ${escapeHtml(inviteeName || 'there')},</h2>
      <p>${escapeHtml(inviterName)} has invited you to join their tournament team!</p>
      <h3>Team: ${escapeHtml(teamName)}</h3>
      <h4>Tournament: ${escapeHtml(tournamentName)}</h4>
      ${message ? `<p><strong>Message:</strong> ${escapeHtml(message)}</p>` : ''}
      <p>To accept this invitation:</p>
      <ol>
        <li>Create a Teamly account or log in if you already have one</li>
        <li>Click this link: <a href="${escapeHtml(inviteUrl)}">Accept Invitation</a></li>
      </ol>
      <p>This invitation will expire in 7 days.</p>
      <p>If you don't want to join this team, you can safely ignore this email.</p>
    `
  })
};

// Type definition for email templates
type EmailTemplateFunction = (...args: unknown[]) => { subject: string; html: string };
type EmailTemplates = Record<string, EmailTemplateFunction>;

// Send email function
export const sendEmail = async (to: string, template: string, ...args: unknown[]): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const transporter = createTransporter();
    const emailTemplate = (emailTemplates as EmailTemplates)[template];
    
    if (!emailTemplate) {
      throw new Error(`Email template "${template}" not found`);
    }

    const { subject, html } = emailTemplate(...args);
    
    // Validate email subject to prevent header injection
    validateNoCRLF(subject, 'Email subject');

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@teamly.app',
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully', 'EmailService', { messageId: info.messageId, to, template });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to send email', 'EmailService', { error: errorMessage, to, template });
    return { success: false, error: errorMessage };
  }
};

// Batch send emails (for multiple recipients)
export const sendBatchEmails = async (
  recipients: Array<{ email: string; name: string }>, 
  template: string, 
  ...args: unknown[]
): Promise<Array<{ success: boolean; messageId?: string; error?: string }>> => {
  const promises = recipients.map(recipient => 
    sendEmail(recipient.email, template, recipient.name, ...args)
  );
  return Promise.all(promises);
};

