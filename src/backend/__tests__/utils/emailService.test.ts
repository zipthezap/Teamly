import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted, so mockSendMail must be declared with vi.hoisted
const mockSendMail = vi.hoisted(() => vi.fn());

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail,
    }),
  },
}));

vi.mock('../../utils/validation', () => ({
  escapeHtml: vi.fn((v: string) => v),
  validateNoCRLF: vi.fn(),
  sanitizeUserInput: vi.fn((v: string) => v),
  isValidEmail: vi.fn(() => true),
}));

import { emailTemplates, sendEmail, sendBatchEmails } from '../../utils/emailService';

beforeEach(() => {
  vi.clearAllMocks();
  mockSendMail.mockResolvedValue({ messageId: 'msg-test-id' });
});

// ---------------------------------------------------------------------------
// emailTemplates
// ---------------------------------------------------------------------------

describe('emailTemplates', () => {
  const testDate = new Date('2024-06-15T10:00:00Z');

  it('eventInvitation returns subject and html', () => {
    const result = emailTemplates.eventInvitation('Alice', 'Soccer Match', testDate, 'FC Team');
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(typeof result.subject).toBe('string');
    expect(result.subject).toContain('Soccer Match');
    expect(result.html).toContain('Alice');
  });

  it('eventUpdate returns subject and html', () => {
    const result = emailTemplates.eventUpdate('Bob', 'Morning Run', 'Running Club');
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result.subject).toContain('Morning Run');
  });

  it('eventCancellation returns subject and html', () => {
    const result = emailTemplates.eventCancellation('Carol', 'Yoga Session', 'Wellness Group');
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result.subject).toContain('Yoga Session');
  });

  it('eventReminder returns subject and html', () => {
    const result = emailTemplates.eventReminder('Dave', 'Team Meeting', testDate, 'Room 101');
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result.subject).toContain('Team Meeting');
    expect(result.html).toContain('Room 101');
  });

  it('groupInvitation returns subject and html', () => {
    const result = emailTemplates.groupInvitation('Eve', 'Chess Club', 'Frank');
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result.subject).toContain('Chess Club');
  });

  it('commentMention returns subject and html', () => {
    const result = emailTemplates.commentMention('Grace', 'Hank', 'Sprint Review', 'Great job!');
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result.subject).toContain('Hank');
  });

  it('emailVerification returns subject and html', () => {
    const result = emailTemplates.emailVerification('Ivy', 'https://example.com/verify?token=abc');
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result.subject).toContain('Verify');
    expect(result.html).toContain('https://example.com/verify?token=abc');
  });

  it('tournamentTeamInvitation returns subject and html', () => {
    const result = emailTemplates.tournamentTeamInvitation(
      'Jack', 'Karen', 'Red Hawks', 'City Cup', 'https://example.com/invite/xyz', 'Join us!',
    );
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result.subject).toContain('Red Hawks');
    expect(result.subject).toContain('City Cup');
    expect(result.html).toContain('Join us!');
  });
});

// ---------------------------------------------------------------------------
// sendEmail
// ---------------------------------------------------------------------------

describe('sendEmail', () => {
  it('calls sendMail with correct fields and returns success', async () => {
    const result = await sendEmail(
      'recipient@example.com',
      'eventInvitation',
      'Alice',
      'Soccer Match',
      new Date(),
      'FC Team',
    );

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const mailArg = mockSendMail.mock.calls[0][0];
    expect(mailArg.to).toBe('recipient@example.com');
    expect(typeof mailArg.subject).toBe('string');
    expect(typeof mailArg.html).toBe('string');
    expect(mailArg.from).toBeDefined();

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-test-id');
  });

  it('returns { success: false } for an unknown template', async () => {
    const result = await sendEmail('recipient@example.com', 'nonExistentTemplate');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('returns { success: false } when sendMail throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));
    const result = await sendEmail(
      'recipient@example.com',
      'eventInvitation',
      'Alice',
      'Soccer Match',
      new Date(),
      'FC Team',
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('SMTP connection refused');
  });

  it('uses EMAIL_FROM env var for the from field', async () => {
    process.env.EMAIL_FROM = 'custom@myapp.com';
    await sendEmail(
      'r@example.com',
      'eventInvitation',
      'Alice',
      'Match',
      new Date(),
      'Team',
    );
    const mailArg = mockSendMail.mock.calls[0][0];
    expect(mailArg.from).toBe('custom@myapp.com');
    delete process.env.EMAIL_FROM;
  });
});

// ---------------------------------------------------------------------------
// sendBatchEmails
// ---------------------------------------------------------------------------

describe('sendBatchEmails', () => {
  it('calls sendMail once per recipient and returns an array of results', async () => {
    const recipients = [
      { email: 'alice@example.com', name: 'Alice' },
      { email: 'bob@example.com', name: 'Bob' },
    ];

    const results = await sendBatchEmails(
      recipients,
      'eventInvitation',
      'Soccer Match',
      new Date(),
      'FC Team',
    );

    expect(mockSendMail).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
  });

  it('all results are { success: true } when sendMail succeeds', async () => {
    const recipients = [
      { email: 'carol@example.com', name: 'Carol' },
      { email: 'dave@example.com', name: 'Dave' },
    ];

    const results = await sendBatchEmails(
      recipients,
      'groupInvitation',
      'Chess Club',
      'Admin',
    );

    expect(results.every((r) => r.success === true)).toBe(true);
  });

  it('returns empty array for empty recipient list', async () => {
    const results = await sendBatchEmails([], 'eventInvitation', 'Event', new Date(), 'Group');
    expect(results).toEqual([]);
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
