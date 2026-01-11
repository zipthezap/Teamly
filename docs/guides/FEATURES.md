# New Features Implementation Guide

This document describes the newly implemented features in Teamly.

## Table of Contents

1. [Public Group Discovery and Join Requests](#public-group-discovery-and-join-requests)
2. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
3. [Event Request with Voting](#event-request-with-voting)
4. [Recurring Events](#recurring-events)

---

## Public Group Discovery and Join Requests

### Overview
Groups can now be marked as "public", allowing any user to discover them and request to join. Admins can approve or reject join requests.

### Backend Implementation

#### Schema Changes
- `Group.isPublic`: Boolean field to mark groups as public
- `GroupJoinRequest`: Model to track join requests with status (pending, approved, rejected)

#### API Endpoints

1. **GET /api/groups/public** - List all public groups (no auth required)
2. **POST /api/groups/:id/join-request** - Submit a join request
3. **GET /api/groups/:id/join-requests** - Get pending join requests (admin only)
4. **POST /api/groups/:id/join-requests/:requestId** - Approve/reject join request (admin only)

### Usage

#### Creating a Public Group
```bash
POST /api/groups
{
  "name": "Open Soccer League",
  "description": "Join us for weekly soccer matches",
  "isPublic": true
}
```

#### Discovering Public Groups
```bash
GET /api/groups/public
```

#### Requesting to Join
```bash
POST /api/groups/{groupId}/join-request
# No body required, uses authenticated user
```

#### Managing Join Requests (Admin)
```bash
# Get pending requests
GET /api/groups/{groupId}/join-requests

# Approve or reject
POST /api/groups/{groupId}/join-requests/{requestId}
{
  "action": "approve"  // or "reject"
}
```

---

## Two-Factor Authentication (2FA)

### Overview
Users can enable 2FA using TOTP (Time-based One-Time Password) for enhanced account security. Supports authenticator apps like Google Authenticator, Authy, etc.

### Backend Implementation

#### Schema Changes
- `User.twoFactorEnabled`: Boolean to indicate if 2FA is enabled
- `User.twoFactorSecret`: Encrypted secret for TOTP generation
- `User.twoFactorBackupCodes`: Array of backup codes for account recovery

#### Dependencies
- `speakeasy`: TOTP generation and verification
- `qrcode`: QR code generation for easy setup

#### API Endpoints

1. **GET /api/2fa/status** - Get 2FA status
2. **POST /api/2fa/setup** - Generate secret and QR code
3. **POST /api/2fa/verify** - Verify and enable 2FA
4. **POST /api/2fa/disable** - Disable 2FA (requires password)

### Usage

#### Setting Up 2FA

1. **Get Setup Information**
```bash
POST /api/2fa/setup
```

Response includes:
- `secret`: Base32 encoded secret (for manual entry)
- `qrCode`: Data URL of QR code image
- `backupCodes`: 10 backup codes for account recovery

2. **Verify and Enable**
```bash
POST /api/2fa/verify
{
  "token": "123456"  // From authenticator app
}
```

#### Using 2FA During Login

1. **First Login Attempt**
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}
```

If 2FA is enabled, response will be:
```json
{
  "requires2FA": true,
  "userId": "uuid"
}
```

2. **Second Login with 2FA Token**
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password",
  "twoFactorToken": "123456"
}
```

#### Disabling 2FA
```bash
POST /api/2fa/disable
{
  "password": "your-password"
}
```

### Security Features

- **Backup Codes**: 10 single-use backup codes generated during setup
- **Time Window**: 2-step tolerance for clock drift
- **Password Required**: Disabling 2FA requires password confirmation

---

## Event Request with Voting

### Overview
Admins can create event requests that require member approval through voting before becoming actual events. This democratic approach ensures events have sufficient interest.

### Backend Implementation

#### Schema Changes
- `EventRequest`: Model for proposed events with voting status
- `EventVote`: Model to track individual votes (yes/no)

#### API Endpoints

1. **POST /api/event-requests** - Create event request (any group member)
2. **GET /api/event-requests/group/:groupId** - Get event requests for a group
3. **GET /api/event-requests/:id** - Get specific event request
4. **POST /api/event-requests/:id/vote** - Vote on event request
5. **POST /api/event-requests/:id/finalize** - Finalize and create event (admin only)
6. **POST /api/event-requests/:id/cancel** - Cancel event request (admin only)

### Usage

#### Creating an Event Request (Any Group Member)
```bash
POST /api/event-requests
{
  "groupId": "uuid",
  "title": "Weekend Soccer Match",
  "description": "Let's play soccer this weekend",
  "eventType": "soccer",
  "location": "Central Park",
  "startTime": "2024-01-15T14:00:00Z",
  "endTime": "2024-01-15T16:00:00Z",
  "maxPlayers": 20
}
```

#### Viewing Event Requests
```bash
# Get all requests for a group
GET /api/event-requests/group/{groupId}

# Get specific request with vote details
GET /api/event-requests/{requestId}
```

#### Voting on Event Request
```bash
POST /api/event-requests/{requestId}/vote
{
  "vote": "yes"  // or "no"
}
```

Members can:
- Vote "yes" or "no"
- Change their vote before finalization
- View current vote counts

#### Finalizing Event Request (Admin)
```bash
POST /api/event-requests/{requestId}/finalize
```

The system will:
1. Count yes vs no votes
2. If yes votes > no votes: Create the actual event
3. If no votes >= yes votes: Mark as cancelled
4. Return the created event or cancellation message

#### Canceling Event Request (Admin)
```bash
POST /api/event-requests/{requestId}/cancel
```

### Workflow

1. **Member creates event request** → Status: "voting"
2. **Members vote** → Each member votes yes/no
3. **Admin finalizes** → 
   - If majority yes: Status → "finalized", Event created
   - If not enough support: Status → "cancelled"

### Vote Counting Rules

- Event is created if: `yesVotes > noVotes`
- Event is cancelled if: `noVotes >= yesVotes`
- Only finalized events appear in the regular event list

---

## Database Migration

Run the following to apply all schema changes:

```bash
# Using Prisma
npx prisma migrate deploy

# Or using npm script
npm run prisma:migrate
```

The migration includes:
- 2FA fields on User model
- EventRequest and EventVote models
- All necessary foreign keys and constraints

---

## Testing the Features

### Local Testing

1. Start the backend:
```bash
npm start
```

2. Use the provided test scripts or API client (Postman, curl, etc.)

### Example Test Flow

#### Public Groups
```bash
# Create a public group
curl -X POST http://localhost:3000/api/groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Public Soccer","isPublic":true}'

# Discover public groups (no auth)
curl http://localhost:3000/api/groups/public

# Request to join
curl -X POST http://localhost:3000/api/groups/$GROUP_ID/join-request \
  -H "Authorization: Bearer $TOKEN"
```

#### 2FA
```bash
# Setup 2FA
curl -X POST http://localhost:3000/api/2fa/setup \
  -H "Authorization: Bearer $TOKEN"

# Verify with token from authenticator app
curl -X POST http://localhost:3000/api/2fa/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"123456"}'

# Login with 2FA
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass","twoFactorToken":"123456"}'
```

#### Event Voting
```bash
# Create event request (admin)
curl -X POST http://localhost:3000/api/event-requests \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"groupId":"uuid","title":"Soccer Match","eventType":"soccer","startTime":"2024-01-15T14:00:00Z"}'

# Vote on request
curl -X POST http://localhost:3000/api/event-requests/$REQUEST_ID/vote \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vote":"yes"}'

# Finalize (admin)
curl -X POST http://localhost:3000/api/event-requests/$REQUEST_ID/finalize \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Security Considerations

### 2FA Implementation
- Secrets are stored securely in the database
- Backup codes are single-use only
- Time-based tokens expire quickly
- Password required to disable 2FA

### Join Requests
- Admin-only approval prevents unauthorized access
- Requests are linked to specific users (no anonymous requests)
- Status tracking prevents duplicate processing

### Event Voting
- Only group members can vote
- One vote per user (can be updated)
- Admin-only finalization prevents abuse
- Vote counts are transparent to all members

---

## Frontend Integration (TODO)

The backend is complete. Frontend implementation should include:

### Public Groups
- Browse page for public groups
- Join request submission UI
- Admin panel for managing join requests
- Notifications for approved/rejected requests

### 2FA
- Setup wizard with QR code display
- Backup code download/print option
- Login flow with 2FA token input
- Account settings page for enabling/disabling

### Event Voting
- Event request creation form (admin)
- Voting interface for members
- Vote results visualization
- Finalization button (admin)

---

## Known Limitations

1. **Email Notifications**: Not yet implemented. Users won't receive emails for:
   - Join request updates
   - Event request notifications
   - 2FA setup/changes

2. **Real-time Updates**: No WebSocket implementation yet
   - Vote counts update on page refresh
   - Join request status updates on refresh

3. **Mobile App**: Features are backend-only
   - QR code scanning may need native implementation
   - Push notifications not available

---

## Future Enhancements

1. **Email Integration**
   - SendGrid/AWS SES for notifications
   - Email templates for all events

2. **Real-time Updates**
   - Socket.io for live vote counts
   - Instant join request notifications

3. **Advanced Voting**
   - Voting deadlines
   - Minimum vote requirements
   - Vote delegation

4. **2FA Enhancements**
   - SMS-based 2FA option
   - Biometric support (mobile)
   - Remember trusted devices

---

## Support and Contribution

For issues or questions, please refer to:
- API Documentation: `../API_DOCUMENTATION.md`
- Main README: `../../README.md`
- Feature Roadmap: `FEATURE_ROADMAP.md`
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

---

## Recurring Events

### Overview
Users can create events that repeat on a schedule (daily, weekly, or monthly). The recurring event feature uses the iCalendar RRULE format for defining recurrence patterns.

### Backend Implementation

#### Schema Changes
- `Event.isRecurring`: Boolean to indicate if event repeats
- `Event.recurrenceRule`: RRULE format string defining the pattern
- `Event.recurrenceEnd`: Optional end date for recurrence
- `Event.parentEventId`: Reference to parent event for instances
- `Event.exceptionDates`: Array of dates to skip (holidays, etc.)

#### Key Components

**Recurrence Service** (`src/backend/utils/recurrenceService.ts`)
- `validateRecurrenceRule(rule)`: Validates RRULE format
- `generateRecurrenceInstances()`: Generates event instances based on rule
- `RecurrencePatterns`: Helper methods for common patterns
- `getNextOccurrence()`: Gets next instance date
- `calculateDuration()`: Calculates event duration
- `applyDuration()`: Applies duration to generate end times

#### API Endpoints

1. **POST /api/events** - Create recurring event (include isRecurring fields)
2. **GET /api/events/:id/instances** - Get recurring event instances
   - Query params: `startDate`, `endDate`, `limit`
3. **POST /api/events/:id/exceptions** - Add exception date
4. **DELETE /api/events/:id/exceptions** - Remove exception date

### Frontend Implementation

#### EventForm Component
Enhanced with recurring event controls:
- **Recurring Toggle**: Switch to enable/disable recurrence
- **Pattern Selector**: Choose Daily, Weekly, or Monthly
- **Interval Input**: Specify repeat frequency (every N days/weeks/months)
- **Day Selector**: For weekly patterns, select which days
- **End Date**: Optional recurrence end date

#### RRULE Generation
The frontend builds RRULE strings based on user selections:
- **Daily**: `FREQ=DAILY;INTERVAL=1`
- **Weekly**: `FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=1`
- **Monthly**: `FREQ=MONTHLY;BYMONTHDAY=15;INTERVAL=1`

### Usage Examples

#### Creating a Daily Recurring Event
```javascript
POST /api/events
{
  "groupId": "uuid",
  "title": "Morning Jog",
  "eventType": "running",
  "startTime": "2024-01-15T07:00:00Z",
  "endTime": "2024-01-15T08:00:00Z",
  "isRecurring": true,
  "recurrenceRule": "FREQ=DAILY;INTERVAL=1",
  "recurrenceEnd": "2024-12-31T23:59:59Z"
}
```

#### Creating a Weekly Recurring Event
```javascript
POST /api/events
{
  "groupId": "uuid",
  "title": "Soccer Practice",
  "eventType": "football",
  "startTime": "2024-01-15T18:00:00Z",
  "endTime": "2024-01-15T20:00:00Z",
  "isRecurring": true,
  "recurrenceRule": "FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=1"
}
```

#### Getting Event Instances
```bash
GET /api/events/:id/instances?startDate=2024-01-01&endDate=2024-02-01&limit=50
```

Response:
```json
[
  {
    "id": "event-uuid-2024-01-15T18:00:00.000Z",
    "title": "Soccer Practice",
    "startTime": "2024-01-15T18:00:00.000Z",
    "endTime": "2024-01-15T20:00:00.000Z",
    "parentEventId": "event-uuid",
    "isInstance": true
  },
  ...
]
```

#### Adding Exception Dates
Skip specific occurrences (e.g., holidays):
```bash
POST /api/events/:id/exceptions
{
  "exceptionDate": "2024-12-25T18:00:00Z"
}
```

### Supported Recurrence Patterns

#### Daily
- Repeat every N days
- Example: "Every 2 days" → `FREQ=DAILY;INTERVAL=2`

#### Weekly
- Repeat every N weeks on specific days
- Days: MO, TU, WE, TH, FR, SA, SU
- Example: "Every week on Mon, Wed, Fri" → `FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=1`

#### Monthly
- Repeat every N months on the same day
- Example: "Every month on the 15th" → `FREQ=MONTHLY;BYMONTHDAY=15;INTERVAL=1`

### User Interface

When creating an event, users can:
1. Toggle "Recurring Event" switch
2. Select pattern (Daily/Weekly/Monthly)
3. Set repeat interval (every N periods)
4. For weekly: select specific days of week
5. Optionally set end date

The UI provides clear feedback:
- "Repeat every 1 week" (or "2 weeks", etc.)
- Day buttons show selected state
- End date is optional with helpful text

### Technical Notes

#### Recurrence Limits
- Default instance limit: 100 occurrences
- Default time range: 1 year if no end date specified
- Backend validates RRULE format before saving

#### Instance IDs
Virtual instances use composite IDs: `{parentId}-{instanceDate}`
This allows unique identification without database storage.

#### Exception Dates
Stored as JSON array of ISO date strings. Used to skip specific occurrences
(holidays, cancelled dates, etc.).

#### Performance
Instances are generated on-demand, not stored in database. This keeps
database size manageable and allows easy pattern updates.

### Best Practices

1. **Set End Dates**: For long-running recurring events, set an end date
   to prevent indefinite recurrence.

2. **Use Exceptions Wisely**: For skipping holidays or special dates,
   use exception dates rather than complex RRULE patterns.

3. **Weekly vs Daily**: For events that happen on specific weekdays,
   use WEEKLY pattern with BYDAY, not daily with complex rules.

4. **Testing**: Always test recurring event creation to ensure the
   pattern generates expected instances.

### Troubleshooting

**Issue**: Invalid recurrence rule error
- **Solution**: Ensure RRULE format is correct. Use RecurrencePatterns helpers.

**Issue**: Too many instances generated
- **Solution**: Set `recurrenceEnd` date or use smaller `limit` parameter.

**Issue**: Wrong days in weekly pattern
- **Solution**: Verify day codes (MO, TU, WE, TH, FR, SA, SU) are correct.

**Issue**: Monthly events on wrong dates
- **Solution**: Check BYMONTHDAY value matches intended day of month.
