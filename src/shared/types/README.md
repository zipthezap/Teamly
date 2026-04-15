# Shared TypeScript Types

This directory contains comprehensive TypeScript interfaces and types for all main objects in the Teamly application, based on the Prisma database schema.

## Structure

The types are organized by domain into separate files:

### Core Types

- **`user.types.ts`** - User, authentication, and session types
  - `User`, `PublicUser`, `UserProfile`
  - `UserRegistrationData`, `UserLoginData`, `UserUpdateData`, `PasswordUpdateData`
  - `TokenPayload`, `AuthResponse`
  - `RefreshToken`, `RevokedToken`, `UserSession`

- **`group.types.ts`** - Group and member types
  - `Group`, `GroupWithDetails`
  - `GroupMember`, `GroupJoinRequest`, `GroupMessage`
  - `CreateGroupData`, `UpdateGroupData`, `GroupSearchParams`

- **`event.types.ts`** - Event and participation types
  - `Event`, `EventWithDetails`
  - `EventParticipant`, `GuestParticipant`
  - `EventAttendance`, `EventReminder`
  - `EventRequest`, `EventVote`
  - `CreateEventData`, `UpdateEventData`, `EventSearchParams`, `CreateEventRequestData`

- **`notification.types.ts`** - Notification types
  - `EventNotification`, `GroupNotification`, `TeamUpNotification`
  - `BaseNotification`, `Notification` (union type)
  - `NotificationQueryParams`, `NotificationStats`

- **`teamup.types.ts`** - TeamUp request and response types
  - `TeamUpRequest`, `TeamUpRequestWithDetails`
  - `TeamUpRequestPosition`
  - `TeamUpResponse`
  - `CreateTeamUpRequestData`, `UpdateTeamUpRequestData`, `TeamUpRequestFilters`

- **`comment.types.ts`** - Comment and mention types
  - `Comment`, `CommentWithDetails`
  - `CommentMention`
  - `CreateCommentData`, `UpdateCommentData`

- **`email.types.ts`** - Email preference and queue types
  - `EmailPreference`, `UpdateEmailPreferenceData`
  - `EmailQueue`, `CreateEmailQueueData`

- **`common.types.ts`** - Common utility types
  - `ApiSuccessResponse`, `ApiErrorResponse`, `ApiResponse`
  - `PaginationMeta`, `PaginationParams`
  - `ValidationResult`, `ValidationError`
  - `LocationData`, `Coordinates`, `DateRange`
  - `ID`, `OptionalID`

### Index File

- **`index.ts`** - Central export point for all types

## Usage

### Backend (Node.js/TypeScript)

```typescript
import { User, CreateEventData, PublicUser, ValidationResult } from '../../shared/types';

// In controllers
export const createEvent = async (req: Request, res: Response) => {
  const eventData: CreateEventData = req.body;
  // ...
};

// In middleware
declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

// In services
export const validateEventTimes = (startTime: string, endTime?: string): ValidationResult => {
  // ...
};
```

### Frontend (React/TypeScript)

```typescript
import { 
  CreateTeamUpRequestData, 
  UpdateTeamUpRequestData, 
  TeamUpRequestFilters,
  Event,
  Group
} from '../../../shared/types';

// In API services
export const teamUpAPI = {
  create: (data: CreateTeamUpRequestData) => api.post('/teamup', data),
  update: (id: string, data: UpdateTeamUpRequestData) => api.put(`/teamup/${id}`, data),
};

// In components
interface EventCardProps {
  event: Event;
  onEdit?: () => void;
}
```

## Design Principles

1. **Single Source of Truth**: All types are defined once in the shared directory and imported throughout the application.

2. **Prisma Schema Alignment**: Types closely match the Prisma schema models to ensure consistency between database and application layers.

3. **Flexible Relations**: Types include both base objects and "WithDetails" variants that include related data (e.g., `Event` vs `EventWithDetails`).

4. **Date Flexibility**: Date fields accept both `Date` and `string` types to handle serialization/deserialization between frontend and backend.

5. **Optional Fields**: Uses `?` for optional fields and `| null` where the database allows null values.

6. **Type Safety**: Provides strong typing for data transfer objects (DTOs) like `CreateEventData`, `UpdateEventData`, etc.

7. **Common Patterns**: Reusable types like `PublicUser`, `ValidationResult`, and `PaginationMeta` reduce duplication.

## Benefits

- **Type Safety**: Catch type errors at compile time across the entire stack
- **IntelliSense**: Better IDE autocomplete and documentation
- **Consistency**: Ensures frontend and backend use the same data structures
- **Maintainability**: Changes to types are reflected everywhere they're used
- **Documentation**: Types serve as living documentation of the data models

## Extending

When adding new models to the Prisma schema:

1. Create corresponding interfaces in the appropriate type file
2. Include both the base interface and any necessary variants (e.g., `WithDetails`, `Create`, `Update`)
3. Export the new types from `index.ts`
4. Update this README to document the new types
