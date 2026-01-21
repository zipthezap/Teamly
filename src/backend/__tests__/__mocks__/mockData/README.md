# Mock Data Documentation

This directory contains centralized mock data for backend testing. All mock data is organized by domain to make it easier to reuse across different test files.

## Structure

```
mockData/
├── events.ts         # Event-related mock data
├── groups.ts         # Group-related mock data
├── notifications.ts  # Notification-related mock data
├── users.ts          # User-related mock data
└── index.ts          # Main export file
```

## Usage

### Importing Mock Data

You can import mock data in your test files:

```typescript
// Import specific mocks
import { mockEvent, mockEventWithGroup } from '../__mocks__/mockData';

// Import all from a specific domain
import { mockGroup, mockGroupMembers, mockGroupAdmins } from '../__mocks__/mockData';

// Import from the index file
import { mockUser, mockEvent, mockGroup } from '../__mocks__/mockData';
```

### Available Mock Data

#### Events (`events.ts`)
- `mockEvent` - Basic event object
- `mockEventWithGroup` - Event with group relationship
- `mockRecurringEvent` - Recurring event with recurrence rule
- `mockPastEvent` - Event in the past
- `mockUpcomingEvent` - Future event
- `mockFullEvent` - Event at capacity
- `mockEventParticipant` - Single participant
- `mockEventParticipants` - Array of participants
- `mockEventActivity` - Event activity records
- `mockEvents` - Collection of various events

#### Groups (`groups.ts`)
- `mockGroup` - Basic group object
- `mockGroupWithMembers` - Group with members
- `mockGroupWithEvents` - Group with events
- `mockPrivateGroup` - Private group
- `mockGroupMember` - Single group member
- `mockGroupMembers` - Array of members
- `mockGroupAdmins` - Array of admin members
- `mockJoinRequest` - Join request object
- `mockGroupInvitation` - Invitation object
- `mockGroups` - Collection of various groups

#### Notifications (`notifications.ts`)
- `mockEventNotification` - Single event notification
- `mockEventNotifications` - Array of event notifications
- `mockGroupNotification` - Single group notification
- `mockGroupNotifications` - Array of group notifications
- `mockTeamUpNotifications` - TeamUp notifications
- `mockTournamentNotifications` - Tournament notifications
- `mockAllNotifications` - All notification types combined
- `mockUnreadNotifications` - Unread notifications only
- `mockReadNotifications` - Read notifications only
- `mockBulkNotifications` - 100 notifications for bulk testing

#### Users (`users.ts`)
- `mockUser` - Basic user object
- `mockUserWithProfile` - User with profile details
- `mockUsers` - Array of different users
- `mockUsersWithDetails` - Users with full profiles
- `mockUsersByCity` - Users grouped by city
- `mockUsersWithNotificationPrefs` - Users with email notifications enabled
- `mockAdmin` - Admin user
- `mockModerator` - Moderator user

## Best Practices

### 1. Use Centralized Mocks When Possible

Instead of creating inline mock data:
```typescript
// ❌ Avoid
const mockEvent = {
  id: 'event-1',
  title: 'Soccer Match',
  // ... many more fields
};
```

Use the centralized mock:
```typescript
// ✅ Better
import { mockEvent } from '../__mocks__/mockData';
```

### 2. Customize Mocks When Needed

You can customize centralized mocks for specific test cases:
```typescript
import { mockEvent } from '../__mocks__/mockData';

const customEvent = {
  ...mockEvent,
  title: 'Custom Title',
  maxParticipants: 50,
};
```

### 3. Create Variations for Complex Scenarios

For tests requiring specific states:
```typescript
import { mockEvent } from '../__mocks__/mockData';

// Archived event
const archivedEvent = { ...mockEvent, archived: true };

// Full event
const fullEvent = { ...mockEvent, maxParticipants: 10 };
```

### 4. Use Type Safety

All mock data is typed according to Prisma models:
```typescript
import { Event } from '@prisma/client';
import { mockEvent } from '../__mocks__/mockData';

// mockEvent is properly typed as Event
const event: Event = mockEvent;
```

## Extending Mock Data

When adding new mock data:

1. **Add to the appropriate domain file** (`events.ts`, `groups.ts`, etc.)
2. **Export from the domain file**
3. **Re-export from `index.ts`** for convenient access
4. **Document new mocks** in this README
5. **Use consistent naming** (e.g., `mock*`, `mock*With*`, `mock*s` for arrays)

### Example: Adding New Mock Data

```typescript
// In events.ts
export const mockCancelledEvent = {
  ...mockEvent,
  id: 'event-cancelled',
  title: 'Cancelled Event',
  cancelled: true,
  cancelledAt: new Date('2024-01-15T00:00:00Z'),
};

// In index.ts (automatically exported via export *)
// No changes needed if using export * from './events'

// In your test file
import { mockCancelledEvent } from '../__mocks__/mockData';
```

## Testing with Mock Data

### Example Test Using Centralized Mocks

```typescript
import { vi, describe, it, expect } from 'vitest';
import prisma from '../../config/database';
import { mockEvent, mockEventParticipants } from '../__mocks__/mockData';

describe('Event Service', () => {
  it('should find event by ID', async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce(mockEvent as any);

    const result = await prisma.event.findUnique({
      where: { id: mockEvent.id },
    });

    expect(result).toEqual(mockEvent);
  });

  it('should list event participants', async () => {
    vi.mocked(prisma.eventParticipant.findMany).mockResolvedValueOnce(
      mockEventParticipants as any
    );

    const result = await prisma.eventParticipant.findMany({
      where: { eventId: 'event-1' },
    });

    expect(result).toHaveLength(3);
  });
});
```

## Benefits

1. **Consistency** - Same mock data used across all tests
2. **Maintainability** - Update mock data in one place
3. **Readability** - Tests are cleaner and easier to understand
4. **Type Safety** - TypeScript ensures mock data matches Prisma models
5. **Reusability** - No need to recreate mock data for each test
6. **Testing Coverage** - Pre-defined edge cases and scenarios

## Notes

- All dates in mock data use consistent ISO format
- IDs use descriptive prefixes (e.g., `event-1`, `user-1`, `notif-1`)
- Mock data includes relationships where applicable
- Arrays contain diverse examples for different test scenarios
- Bulk data (e.g., `mockBulkNotifications`) is generated programmatically
