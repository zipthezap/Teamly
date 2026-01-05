# New Features Implementation Guide

This document provides detailed information about the newly implemented features in Teamly: Email Notifications, Recurring Events, and Event Comments.

---

## Table of Contents

1. [Email Notifications](#email-notifications)
2. [Recurring Events](#recurring-events)
3. [Event Comments](#event-comments)
4. [Configuration](#configuration)
5. [API Endpoints](#api-endpoints)

---

## Email Notifications

### Overview

Teamly now supports email notifications for various events and activities. Users can:
- Receive notifications about event invitations, updates, and cancellations
- Get reminders before events start
- Be notified when invited to groups
- Receive notifications when mentioned in comments
- Customize which notifications they want to receive
- Verify their email address

### Features

- **Event Invitations**: Users receive emails when invited to events
- **Event Updates**: Users are notified when event details change
- **Event Cancellations**: Users receive notifications when events are cancelled
- **Event Reminders**: Upcoming event reminders (requires background job setup)
- **Group Invitations**: Users are notified when invited to groups
- **Comment Mentions**: Users receive notifications when mentioned in comments
- **Email Verification**: Users can verify their email addresses

### Database Schema

```prisma
model User {
  // ... existing fields
  emailNotifications Boolean  @default(true)
  emailVerified      Boolean  @default(false)
  emailVerificationToken String?
  emailPreferences  EmailPreference?
}

model EmailPreference {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  eventInvites    Boolean  @default(true)
  eventReminders  Boolean  @default(true)
  eventUpdates    Boolean  @default(true)
  eventCancellations Boolean @default(true)
  groupInvites    Boolean  @default(true)
  commentMentions Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Configuration

Add the following environment variables to your `.env` file:

```bash
# Email Configuration
EMAIL_SERVICE=sendgrid  # Options: 'sendgrid', 'ses', or leave blank for SMTP

# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key

# AWS SES Configuration
AWS_SES_HOST=email-smtp.us-east-1.amazonaws.com
AWS_SES_USER=your_ses_user
AWS_SES_PASSWORD=your_ses_password

# Generic SMTP Configuration
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password

# Email From Address
EMAIL_FROM=noreply@teamly.app

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3001
```

### Email Providers

The system supports multiple email providers:

1. **SendGrid**: Set `EMAIL_SERVICE=sendgrid` and provide `SENDGRID_API_KEY`
2. **AWS SES**: Set `EMAIL_SERVICE=ses` and provide AWS SES credentials
3. **Generic SMTP**: Leave `EMAIL_SERVICE` blank and configure SMTP settings

### API Endpoints

#### Get Email Preferences
```http
GET /api/email/preferences
Authorization: Bearer <token>
```

#### Update Email Preferences
```http
PUT /api/email/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventInvites": true,
  "eventReminders": true,
  "eventUpdates": true,
  "eventCancellations": true,
  "groupInvites": true,
  "commentMentions": true
}
```

#### Toggle Email Notifications
```http
PUT /api/email/notifications/toggle
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true
}
```

#### Send Verification Email
```http
POST /api/email/verify/send
Authorization: Bearer <token>
```

#### Verify Email
```http
GET /api/email/verify/:token
```

---

## Recurring Events

### Overview

Teamly now supports creating events that repeat on a schedule. Users can:
- Create events with weekly, monthly, or custom recurrence patterns
- View all instances of a recurring event
- Add exceptions to skip specific dates
- Remove exceptions to restore skipped dates

### Features

- **Flexible Recurrence Patterns**: Daily, weekly, monthly, yearly patterns
- **Custom Intervals**: Repeat every N days/weeks/months
- **Specific Days**: Weekly events on specific days (e.g., every Monday and Wednesday)
- **End Dates**: Set when recurring events should stop
- **Exceptions**: Skip specific dates (e.g., holidays)
- **Instance Generation**: Dynamically generate future event instances

### Database Schema

```prisma
model Event {
  // ... existing fields
  isRecurring     Boolean   @default(false)
  recurrenceRule  String?   // RRULE format
  recurrenceEnd   DateTime?
  parentEventId   String?
  parentEvent     Event?    @relation("RecurringEvents", fields: [parentEventId], references: [id])
  instances       Event[]   @relation("RecurringEvents")
  exceptionDates  Json?     // Array of dates to skip
}
```

### Recurrence Rule Format

Teamly uses the iCalendar RRULE format. Examples:

- **Daily**: `FREQ=DAILY;INTERVAL=1`
- **Weekly (every Monday)**: `FREQ=WEEKLY;BYDAY=MO;INTERVAL=1`
- **Weekly (Mon, Wed, Fri)**: `FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=1`
- **Bi-weekly**: `FREQ=WEEKLY;INTERVAL=2`
- **Monthly (15th of month)**: `FREQ=MONTHLY;BYMONTHDAY=15;INTERVAL=1`
- **Monthly (2nd Tuesday)**: `FREQ=MONTHLY;BYDAY=2TU;INTERVAL=1`

### API Endpoints

#### Create Recurring Event
```http
POST /api/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "groupId": "group-uuid",
  "title": "Weekly Football Match",
  "description": "Every Sunday morning",
  "eventType": "football",
  "location": "Central Park",
  "startTime": "2024-01-20T10:00:00Z",
  "endTime": "2024-01-20T12:00:00Z",
  "maxPlayers": 10,
  "isRecurring": true,
  "recurrenceRule": "FREQ=WEEKLY;BYDAY=SU;INTERVAL=1",
  "recurrenceEnd": "2024-12-31T23:59:59Z"
}
```

#### Get Recurring Event Instances
```http
GET /api/events/:id/instances
Authorization: Bearer <token>

Query Parameters:
- startDate (optional): Start date for instances
- endDate (optional): End date for instances
- limit (optional): Maximum number of instances (default: 100)
```

Response:
```json
[
  {
    "id": "event-uuid-2024-01-20T10:00:00.000Z",
    "title": "Weekly Football Match",
    "startTime": "2024-01-20T10:00:00.000Z",
    "endTime": "2024-01-20T12:00:00.000Z",
    "isInstance": true,
    "parentEventId": "event-uuid",
    ...
  },
  ...
]
```

#### Add Exception Date
```http
POST /api/events/:id/exceptions
Authorization: Bearer <token>
Content-Type: application/json

{
  "exceptionDate": "2024-02-10T10:00:00Z"
}
```

#### Remove Exception Date
```http
DELETE /api/events/:id/exceptions
Authorization: Bearer <token>
Content-Type: application/json

{
  "exceptionDate": "2024-02-10T10:00:00Z"
}
```

### Usage Examples

#### Weekly Team Practice
```javascript
// Every Tuesday and Thursday at 6 PM
{
  "isRecurring": true,
  "recurrenceRule": "FREQ=WEEKLY;BYDAY=TU,TH;INTERVAL=1",
  "startTime": "2024-01-16T18:00:00Z",
  "endTime": "2024-01-16T20:00:00Z"
}
```

#### Monthly Tournament
```javascript
// First Saturday of each month
{
  "isRecurring": true,
  "recurrenceRule": "FREQ=MONTHLY;BYDAY=1SA;INTERVAL=1",
  "startTime": "2024-01-06T09:00:00Z",
  "endTime": "2024-01-06T17:00:00Z"
}
```

---

## Event Comments

### Overview

Teamly now supports a discussion system for events. Users can:
- Add comments to events
- Reply to existing comments (threaded/nested discussions)
- Mention other users with @username syntax
- Receive notifications when mentioned
- Edit and delete their own comments

### Features

- **Threaded Comments**: Support for nested replies
- **User Mentions**: Tag users with @username
- **Email Notifications**: Users are notified when mentioned
- **Real-time Updates**: Comments appear immediately
- **Permission Control**: Users can only edit/delete their own comments

### Database Schema

```prisma
model Comment {
  id        String   @id @default(uuid())
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  
  parentId  String?
  parent    Comment? @relation("CommentReplies", fields: [parentId], references: [id])
  replies   Comment[] @relation("CommentReplies")
  
  mentions  CommentMention[]
}

model CommentMention {
  id        String   @id @default(uuid())
  commentId String
  comment   Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  
  @@unique([commentId, userId])
}
```

### API Endpoints

#### Create Comment
```http
POST /api/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventId": "event-uuid",
  "content": "Looking forward to this! @john can you bring the ball?",
  "parentId": null  // Optional, for replies
}
```

#### Get Event Comments
```http
GET /api/comments/event/:eventId
Authorization: Bearer <token>
```

Response:
```json
[
  {
    "id": "comment-uuid",
    "content": "Looking forward to this! @john can you bring the ball?",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "user": {
      "id": "user-uuid",
      "name": "Jane Doe",
      "email": "jane@example.com"
    },
    "replies": [
      {
        "id": "reply-uuid",
        "content": "Sure, I'll bring it!",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "user": {
          "id": "john-uuid",
          "name": "John Smith"
        },
        "replies": []
      }
    ],
    "mentions": [
      {
        "user": {
          "id": "john-uuid",
          "name": "John Smith"
        }
      }
    ]
  }
]
```

#### Update Comment
```http
PUT /api/comments/:commentId
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated comment text"
}
```

#### Delete Comment
```http
DELETE /api/comments/:commentId
Authorization: Bearer <token>
```

### Mention Syntax

To mention a user in a comment, use the `@username` syntax:
- `@john` - Mentions user with name "john" or email starting with "john"
- Multiple mentions: `@john @jane can you both confirm?`

When a user is mentioned:
1. A `CommentMention` record is created
2. An email notification is sent (if enabled in user preferences)
3. The mention is included in the comment response

### Usage Examples

#### Simple Comment
```javascript
POST /api/comments
{
  "eventId": "event-123",
  "content": "Can't wait for the match!"
}
```

#### Reply to Comment
```javascript
POST /api/comments
{
  "eventId": "event-123",
  "content": "Me too! Should be fun.",
  "parentId": "comment-456"
}
```

#### Comment with Mentions
```javascript
POST /api/comments
{
  "eventId": "event-123",
  "content": "Hey @mike and @sarah, are you bringing equipment?"
}
```

---

## Configuration

### Database Migration

After updating your code, run the Prisma migration to update your database schema:

```bash
npm run prisma:migrate
```

This will create the necessary tables and columns for the new features.

### Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Configure your email provider (see Email Notifications section above)

3. Set your frontend URL for email links:
```bash
FRONTEND_URL=http://localhost:3001
```

### Dependencies

The following new dependencies were added:
- `nodemailer`: Email sending library
- `rrule`: Recurrence rule parsing and generation

These are already included in `package.json` and will be installed with:
```bash
npm install
```

---

## Testing the Features

### Email Notifications

1. Start the server with email configuration
2. Create an event and invite users
3. Check that invited users receive email notifications
4. Update the event and verify update notifications
5. Test email preferences by disabling specific notification types

### Recurring Events

1. Create a recurring event with a recurrence rule:
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "group-uuid",
    "title": "Weekly Training",
    "eventType": "football",
    "startTime": "2024-01-20T10:00:00Z",
    "endTime": "2024-01-20T12:00:00Z",
    "isRecurring": true,
    "recurrenceRule": "FREQ=WEEKLY;BYDAY=SA;INTERVAL=1"
  }'
```

2. Get event instances:
```bash
curl http://localhost:3000/api/events/EVENT_ID/instances \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. Add an exception date:
```bash
curl -X POST http://localhost:3000/api/events/EVENT_ID/exceptions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"exceptionDate": "2024-02-10T10:00:00Z"}'
```

### Event Comments

1. Create a comment on an event:
```bash
curl -X POST http://localhost:3000/api/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "event-uuid",
    "content": "Great event! @john can you confirm?"
  }'
```

2. Get comments for an event:
```bash
curl http://localhost:3000/api/comments/event/EVENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. Reply to a comment:
```bash
curl -X POST http://localhost:3000/api/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "event-uuid",
    "content": "Sure, I confirm!",
    "parentId": "parent-comment-uuid"
  }'
```

---

## Future Enhancements

### Email Notifications
- Background job queue for sending emails asynchronously (Redis + Bull)
- Email templates customization
- Digest emails (daily/weekly summaries)
- Unsubscribe links in emails

### Recurring Events
- Edit all future instances at once
- Convert single event to recurring
- More complex recurrence patterns
- Calendar integration (iCal export)

### Event Comments
- WebSocket support for real-time updates
- Rich text formatting
- File attachments
- Emoji reactions
- Comment search and filtering

---

## Troubleshooting

### Email Not Sending

1. Check email configuration in `.env`
2. Verify SMTP credentials are correct
3. Check server logs for error messages
4. Test with a simple SMTP server like Ethereal Email for development

### Recurring Events Not Generating

1. Verify recurrence rule format is valid
2. Check that `isRecurring` is set to `true`
3. Ensure `recurrenceRule` is provided
4. Check for syntax errors in RRULE format

### Comments Not Working

1. Verify user has access to the event (must be group member)
2. Check that content is not empty
3. For replies, verify parent comment exists and belongs to same event
4. Check server logs for detailed error messages

---

## Support

For issues or questions about these features, please:
1. Check the troubleshooting section above
2. Review the API endpoint documentation
3. Check server logs for detailed error messages
4. Open an issue on the project repository
