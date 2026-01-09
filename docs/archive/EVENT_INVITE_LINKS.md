# Event Invite Links and Public/Private Events

## Overview

This feature allows event organizers to easily share events with people outside their group by creating public events with shareable invite links. Guests can join events without creating an account - they just need to provide their name.

## Features

### 1. Public vs Private Events

When creating an event, organizers can now choose between:

- **Private Event** (default): Only group members can see and join the event
- **Public Event**: Anyone with the invite link can view and join the event, even without an account

### 2. Shareable Invite Links

For public events, organizers can:
- Generate a unique, secure invite token
- Copy the invite link to share via email, messaging apps, social media, etc.
- The link remains active until the event is deleted or made private

### 3. Guest Participation

People who receive an invite link can:
- View event details without logging in
- Join the event by simply entering their name
- No account creation required
- Guest participants are tracked separately from registered users

## User Guide

### Creating a Public Event

1. Navigate to "Create Event"
2. Fill in event details (title, type, location, time, etc.)
3. Toggle the switch to make it a "Public Event"
4. Click "Create"
5. The event is now created with the ability to generate an invite link

### Generating and Sharing an Invite Link

1. Go to the event details page
2. As the event creator, you'll see a "Share Event" section
3. For public events without a link yet:
   - Click "Generate Invite Link"
   - The unique invite URL will be created
4. For public events with an existing link:
   - Click "Copy Invite Link" to copy the URL to clipboard
5. Share the link via any communication channel

### Joining as a Guest

1. Receive an invite link (format: `/events/join/{token}`)
2. Click the link - no login required
3. View the event details:
   - Event title, type, and description
   - Date, time, and location
   - Current number of participants
   - Organizer information
4. Enter your name in the "Join Event" form
5. Click "Join Event"
6. You're now registered as a guest participant!

### Converting Between Private and Public

Event creators can change the event's visibility:
- Edit the event (if edit form supports it)
- Or make it public through the "Share Event" section
- Private events cannot generate invite links
- Making an event private doesn't delete existing invite tokens

## API Endpoints

### Generate Invite Token
```
POST /api/events/:id/generate-invite
Authorization: Bearer {token}
```
Creates a unique invite token for the event and makes it public.

**Response:**
```json
{
  "inviteToken": "abc123...",
  "inviteUrl": "/events/join/abc123..."
}
```

### Get Event by Invite Token (Public)
```
GET /api/events/invite/:token
```
No authentication required. Returns event details for public events.

**Response:**
```json
{
  "id": "event-id",
  "title": "Sunday Football Match",
  "description": "...",
  "eventType": "football",
  "location": "Central Park",
  "startTime": "2024-01-20T10:00:00Z",
  "maxPlayers": 10,
  "isPublic": true,
  "participants": [...],
  "guestParticipants": [...]
}
```

### Join Event as Guest (Public)
```
POST /api/events/invite/:token/join
Content-Type: application/json

{
  "name": "John Doe"
}
```
No authentication required. Creates a guest participant.

**Response:**
```json
{
  "message": "Successfully joined event",
  "participant": {
    "id": "guest-id",
    "name": "John Doe",
    "status": "confirmed",
    "joinedAt": "2024-01-15T14:30:00Z"
  }
}
```

## Database Schema

### Event Table Changes
```prisma
model Event {
  // ... existing fields
  isPublic    Boolean  @default(false)
  inviteToken String?  @unique
  
  guestParticipants GuestParticipant[]
}
```

### New GuestParticipant Table
```prisma
model GuestParticipant {
  id         String   @id @default(uuid())
  name       String
  status     String   @default("confirmed")
  joinedAt   DateTime @default(now())
  
  eventId String
  event   Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
}
```

## Security Considerations

### Invite Tokens
- Tokens are generated using cryptographically secure random bytes (32 bytes = 256 bits)
- Tokens are unique and indexed in the database
- Tokens are only active for public events
- Deleting an event invalidates its invite token

### Guest Participation
- Guests cannot:
  - Access other parts of the application
  - View group details beyond the event
  - Edit or delete events
  - See email addresses or contact info of other participants
- Guest names are sanitized and validated
- Rate limiting applies to guest join requests

### Privacy
- Private events are never accessible via invite links
- Event visibility can only be changed by the event creator
- Guest participants are shown to group members but without any personal data beyond their provided name

## Frontend Components

### JoinEventByInvite Page
- Located at `/events/join/:token`
- No authentication required
- Shows event details
- Provides guest join form
- Handles full/closed events gracefully

### EventForm Component
- Added `isPublic` toggle switch
- Clear explanation of public vs private
- Integrated into CreateEvent page

### EventDetails Page
- Shows "Public Event" badge for public events
- "Share Event" section for event creators
- "Generate Invite Link" or "Copy Invite Link" buttons
- Displays total participant count including guests
- Shows guest participants in the participants list

## Use Cases

1. **Casual Sports Matches**: Organizers can quickly share a pickup game link with friends who don't use the platform
2. **Open Community Events**: Public tournaments or meetups where anyone can join
3. **Last-Minute Invites**: Easily add people without them needing to create accounts first
4. **Trial Events**: Let potential users experience the platform before signing up
5. **Cross-Group Events**: Coordinate with members from multiple communities

## Future Enhancements

Possible improvements for future iterations:
- Guest email collection (optional) for notifications
- Temporary guest accounts that convert to full accounts
- Link expiration dates
- Maximum guest participant limits
- Guest participant management (remove guests)
- Analytics on link sharing and guest conversion rates
- QR code generation for invite links
- Social media preview cards for invite links
