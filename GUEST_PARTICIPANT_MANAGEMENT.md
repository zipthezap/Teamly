# Guest Participant Management

## Overview

This feature provides complete management capabilities for guest participants in events. Previously, the application only allowed guests to join events via invite links, but the `GuestParticipant` schema model and `GuestParticipantStatus` enum were underutilized.

## Schema Features Used

### GuestParticipant Model
```prisma
model GuestParticipant {
  id         String   @id @default(uuid())
  name       String   // Guest's display name
  status     GuestParticipantStatus @default(confirmed)
  joinedAt   DateTime @default(now())
  
  eventId String
  event   Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  
  @@index([eventId])
  @@index([joinedAt]) // For joined date queries
}
```

### GuestParticipantStatus Enum
```prisma
enum GuestParticipantStatus {
  confirmed
  declined
}
```

## New Endpoints

All endpoints are protected and require authentication. Only the event creator can manage guest participants.

### 1. Get Guest Participants

**Endpoint:** `GET /api/events/:id/guests`

**Query Parameters:**
- `status` (optional): Filter by status (`confirmed` or `declined`)

**Description:** Retrieves all guest participants for an event with optional status filtering. Returns a summary with counts by status.

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/events/EVENT_ID/guests?status=confirmed"
```

**Example Response:**
```json
{
  "guestParticipants": [
    {
      "id": "guest-uuid-1",
      "name": "John Guest",
      "status": "confirmed",
      "joinedAt": "2024-01-15T10:00:00Z",
      "eventId": "event-uuid"
    },
    {
      "id": "guest-uuid-2",
      "name": "Jane Guest",
      "status": "confirmed",
      "joinedAt": "2024-01-15T11:30:00Z",
      "eventId": "event-uuid"
    }
  ],
  "summary": {
    "total": 5,
    "filtered": 2,
    "byStatus": {
      "confirmed": 2,
      "declined": 3
    }
  },
  "filter": "confirmed"
}
```

### 2. Update Guest Participant Name

**Endpoint:** `PUT /api/events/:id/guests/:guestId`

**Body Parameters:**
- `name` (required): New name for the guest participant

**Description:** Updates a guest participant's name. Useful for fixing typos or updating information.

**Permissions:** Event creator only

**Example Request:**
```bash
curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Corrected Name"}' \
  "http://localhost:3000/api/events/EVENT_ID/guests/GUEST_ID"
```

**Example Response:**
```json
{
  "id": "guest-uuid",
  "name": "John Corrected Name",
  "status": "confirmed",
  "joinedAt": "2024-01-15T10:00:00Z",
  "eventId": "event-uuid"
}
```

### 3. Update Guest Participant Status

**Endpoint:** `PUT /api/events/:id/guests/:guestId/status`

**Body Parameters:**
- `status` (required): New status (`confirmed` or `declined`)

**Description:** Updates a guest participant's RSVP status. Allows event organizers to mark guests as declined if they cancel, or re-confirm them.

**Permissions:** Event creator only

**Example Request:**
```bash
curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "declined"}' \
  "http://localhost:3000/api/events/EVENT_ID/guests/GUEST_ID/status"
```

**Example Response:**
```json
{
  "id": "guest-uuid",
  "name": "John Guest",
  "status": "declined",
  "joinedAt": "2024-01-15T10:00:00Z",
  "eventId": "event-uuid"
}
```

### 4. Remove Guest Participant

**Endpoint:** `DELETE /api/events/:id/guests/:guestId`

**Description:** Removes a guest participant from the event completely. Use this to clean up the participant list or remove guests who are no longer attending.

**Permissions:** Event creator only

**Example Request:**
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/events/EVENT_ID/guests/GUEST_ID"
```

**Example Response:**
```json
{
  "message": "Guest participant removed successfully"
}
```

## Use Cases

### 1. Correcting Guest Names
Event organizers can fix typos or update guest names after they've joined:
```bash
PUT /api/events/:id/guests/:guestId
Body: { "name": "Corrected Name" }
```

### 2. Managing RSVPs
Track which guests have confirmed vs declined:
```bash
# Get all confirmed guests
GET /api/events/:id/guests?status=confirmed

# Mark a guest as declined
PUT /api/events/:id/guests/:guestId/status
Body: { "status": "declined" }
```

### 3. Event Capacity Management
When an event fills up, organizers can:
1. View all confirmed participants (registered users + guests)
2. Contact declined guests if spots open up
3. Remove guests who are no longer attending

### 4. Cleaning Up Participant Lists
Remove duplicate or invalid guest entries:
```bash
DELETE /api/events/:id/guests/:guestId
```

## Integration with Existing Features

### Max Players Check
The existing `joinEvent` and `joinEventAsGuest` endpoints already account for guest participants when checking event capacity:

```typescript
// In eventController.ts - joinEvent and joinEventAsGuest
const confirmedParticipants = await tx.eventParticipant.count({
  where: { eventId: id, status: 'confirmed' }
});

const confirmedGuests = await tx.guestParticipant.count({
  where: { eventId: id, status: GuestParticipantStatus.confirmed }
});

const totalConfirmed = confirmedParticipants + confirmedGuests;

if (totalConfirmed >= event.maxPlayers) {
  throw new Error('EVENT_FULL');
}
```

### Event Details
The `getEvent` endpoint already includes guest participants:

```typescript
guestParticipants: {
  select: {
    id: true,
    name: true,
    status: true,
    joinedAt: true
  },
  orderBy: {
    joinedAt: 'asc'
  }
}
```

## Performance Considerations

### Index Usage
All queries use database indexes for optimal performance:

- `@@index([eventId])` - Used for filtering guests by event
- `@@index([joinedAt])` - Used for sorting guests by join time

### Query Optimization
The `getGuestParticipants` endpoint uses:
1. Single query to fetch filtered guests
2. Aggregate query for status counts (more efficient than counting in code)
3. Early return if event not found or access denied

## Security

### Authorization
All endpoints verify:
1. User is authenticated (via `authMiddleware`)
2. User is the event creator (checked in each controller method)
3. Guest participant belongs to the specified event

### Validation
- Name field is validated (required, non-empty after trimming)
- Status field is validated against the enum values
- Event ID and Guest ID are validated for existence

## Error Handling

### Common Errors

**404 Not Found**
- Event doesn't exist
- User is not a member of the group
- Guest participant doesn't exist

**403 Forbidden**
- User is not the event creator
- Attempting to manage guests in another user's event

**400 Bad Request**
- Invalid status value
- Empty or missing name
- Invalid request parameters

## Testing

### Manual Testing Flow

1. **Create an event with an invite link:**
```bash
POST /api/events
# Get the inviteToken from response
```

2. **Join as a guest:**
```bash
POST /api/events/invite/:token/join
Body: { "name": "Test Guest" }
# Save the guest participant ID from response
```

3. **List all guests:**
```bash
GET /api/events/:id/guests
```

4. **Update guest name:**
```bash
PUT /api/events/:id/guests/:guestId
Body: { "name": "Updated Guest Name" }
```

5. **Update guest status:**
```bash
PUT /api/events/:id/guests/:guestId/status
Body: { "status": "declined" }
```

6. **Remove guest:**
```bash
DELETE /api/events/:id/guests/:guestId
```

### Automated Testing Considerations

When writing tests, consider:
- Transaction isolation for concurrent joins
- Max players boundary conditions
- Permission checks for non-creators
- Status filter correctness
- Index usage verification

## Future Enhancements

### Potential Improvements

1. **Guest Contact Information**
   - Add optional email/phone fields to GuestParticipant model
   - Allow organizers to send notifications to guests

2. **Guest Notes**
   - Add notes field for organizers to track additional info
   - Example: dietary restrictions, transportation needs

3. **Guest History**
   - Track when status changes occur
   - Log who made changes (if allowing admin access)

4. **Bulk Operations**
   - Bulk update guest statuses
   - Bulk import/export guest lists

5. **Guest Analytics**
   - Track no-show rates for guests
   - Compare guest vs registered user attendance patterns

## Migration Notes

This feature is **backward compatible**:
- Existing guest participants continue to work
- No database migrations required
- All existing functionality remains unchanged
- New endpoints are additive only

## Summary

This implementation fully utilizes the `GuestParticipant` schema features that were previously underutilized:

✅ **Complete CRUD operations** for guest participants  
✅ **Status management** using the `GuestParticipantStatus` enum  
✅ **Filtering and querying** with optimal index usage  
✅ **Secure authorization** restricted to event creators  
✅ **Integration** with existing event capacity checks  
✅ **Backward compatible** with no breaking changes  

The feature provides event organizers with full control over guest participants, making the guest RSVP system as powerful as the registered user system.
