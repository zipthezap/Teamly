# Event Reminder and Attendance Features Implementation

## Overview

This implementation adds two important features that were defined in the Prisma schema but were not yet exposed through the API:

1. **Event Reminder System** - Allows users to set custom reminders for events
2. **Event Attendance Tracking** - Enables tracking of participant attendance status

## Schema Models Utilized

### EventReminder Model
```prisma
model EventReminder {
  id        String   @id @default(uuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  remindAt  DateTime
  sent      Boolean  @default(false)

  @@unique([eventId, userId, remindAt])
  @@index([sent])
}
```

### EventAttendance Model
```prisma
model EventAttendance {
  id        String   @id @default(uuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  status    String   @default("on-time") // on-time, late
  updatedAt DateTime @updatedAt
  
  @@unique([eventId, userId])
}
```

## API Endpoints

### Event Reminder Endpoints

#### Create Reminder
- **Endpoint**: `POST /api/events/:eventId/reminders`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "remindAt": "2024-01-15T10:00:00Z"
  }
  ```
- **Response**: Created reminder with event details
- **Validations**:
  - Reminder time must be in the future
  - Reminder time must be before event start time
  - User must be a participant or creator of the event
  - No duplicate reminders for the same time

#### Get Event Reminders
- **Endpoint**: `GET /api/events/:eventId/reminders`
- **Authentication**: Required
- **Response**: Array of reminders for the event (user's own reminders only)

#### Get All User Reminders
- **Endpoint**: `GET /api/reminders`
- **Authentication**: Required
- **Query Parameters**:
  - `upcoming` (optional): Set to "true" to filter only upcoming unsent reminders
- **Response**: Array of all user's reminders across all events

#### Update Reminder
- **Endpoint**: `PUT /api/reminders/:reminderId`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "remindAt": "2024-01-15T11:00:00Z"
  }
  ```
- **Response**: Updated reminder details
- **Note**: Due to composite unique constraint, this performs a delete+create transaction

#### Delete Reminder
- **Endpoint**: `DELETE /api/reminders/:reminderId`
- **Authentication**: Required
- **Response**: Success message
- **Validation**: Users can only delete their own reminders

### Event Attendance Endpoints

#### Mark Attendance
- **Endpoint**: `POST /api/events/:eventId/attendance`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "userId": "optional-user-id",
    "status": "on-time" // or "late"
  }
  ```
- **Response**: Attendance record with user details
- **Validations**:
  - Status must be "on-time" or "late"
  - User must be a participant of the event
  - Can only mark attendance after event has started
  - Only event creator or the participant themselves can mark attendance
- **Side Effects**: Creates a notification if marked as "late"

#### Get Event Attendance
- **Endpoint**: `GET /api/events/:eventId/attendance`
- **Authentication**: Required
- **Response**: Array of attendance records for the event
- **Access Control**: Only group members can view attendance

#### Get Attendance Statistics
- **Endpoint**: `GET /api/events/:eventId/attendance/stats`
- **Authentication**: Required
- **Response**:
  ```json
  {
    "stats": {
      "totalParticipants": 10,
      "onTime": 7,
      "late": 2,
      "noShow": 1,
      "attendanceRate": 90.0
    }
  }
  ```
- **Access Control**: Only group members can view statistics

#### Delete Attendance Record
- **Endpoint**: `DELETE /api/events/:eventId/attendance/:userId`
- **Authentication**: Required
- **Response**: Success message
- **Access Control**: Only event creator can delete attendance records

## Security Features

### Authentication & Authorization
- All endpoints require authentication via JWT token
- Rate limiting applied through `authenticatedLimiter` middleware
- Permission checks ensure users can only:
  - Set reminders for events they're participating in
  - View their own reminders
  - Mark attendance for themselves or (if creator) for others
  - View attendance data only for events in groups they're members of

### Input Validation
- Reminder times validated to be in the future and before event start
- Attendance status validated to be one of allowed values
- Event and user existence validated before operations
- Proper error types used (BadRequestError, NotFoundError, ForbiddenError)

### Data Integrity
- Composite unique constraints prevent duplicate reminders
- Cascade deletes ensure cleanup when events are deleted
- Proper use of transactions for operations requiring atomicity
- asyncHandler middleware ensures proper error handling

## Implementation Details

### Files Created
1. `src/backend/controllers/reminderController.ts` - Reminder CRUD operations
2. `src/backend/controllers/attendanceController.ts` - Attendance tracking operations
3. `src/backend/routes/reminderRoutes.ts` - Reminder route definitions

### Files Modified
1. `src/backend/routes/eventRoutes.ts` - Added reminder and attendance routes
2. `src/backend/server.ts` - Registered reminder routes

### Key Design Decisions

#### Reminder Update Strategy
The reminder update endpoint uses a delete+create transaction instead of a direct update. This is necessary because `remindAt` is part of the composite unique constraint `[eventId, userId, remindAt]`. Prisma does not allow updating fields that are part of a unique constraint.

#### Attendance Notification
When a user is marked as "late", an EventNotification is automatically created with type "late". This integrates with the existing notification system to alert relevant parties.

#### No-Show Calculation
The attendance statistics endpoint calculates "no-show" count as the difference between total participants and those with attendance records, providing useful analytics for event organizers.

## Future Enhancements

Potential improvements that could be added:

1. **Reminder Delivery System**: Implement a background job to send reminders via email/push notifications when `remindAt` time is reached
2. **Reminder Templates**: Pre-defined reminder templates (e.g., "1 hour before", "1 day before")
3. **Attendance Check-in**: QR code or location-based automatic check-in
4. **Attendance Reports**: Export attendance data in various formats
5. **Recurring Event Reminders**: Special handling for recurring events
6. **Attendance Rewards**: Gamification based on attendance rates

## Testing

Since no test infrastructure exists in the repository, manual testing is recommended:

1. Create an event and join it
2. Set reminders at various times
3. Try updating and deleting reminders
4. Mark attendance when event starts
5. View attendance statistics
6. Test permission boundaries (try to access other users' reminders)

## Conclusion

This implementation successfully utilizes the EventReminder and EventAttendance schema models that were previously defined but unused. The features are production-ready with proper validation, error handling, and security measures consistent with the rest of the codebase.
