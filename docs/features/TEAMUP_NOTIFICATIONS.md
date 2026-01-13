# TeamUp Notifications

This document describes the TeamUp notification system implemented in Teamly.

## Overview

TeamUp notifications keep users informed about activities related to their TeamUp requests and responses. All notifications are available in both English and French.

## Notification Types

### 1. teamup_response
**Trigger**: When someone applies to your TeamUp request

**Recipients**: TeamUp request creator

**Parameters**:
- `name`: Name of the person who applied
- `title`: Title of the TeamUp request
- `sportType`: Type of sport

**Translation Keys**:
- Backend: `teamupResponse`, `teamupResponseMessage`
- Frontend: `notifications.teamup_response`

**Example**:
- EN: "John Doe applied to your TeamUp request 'Need 2 players for Basketball'"
- FR: "John Doe a postulé à votre demande TeamUp 'Besoin de 2 joueurs pour Basketball'"

### 2. teamup_accepted
**Trigger**: When a TeamUp request creator accepts your application

**Recipients**: Person who applied to the request

**Parameters**:
- `title`: Title of the TeamUp request
- `sportType`: Type of sport

**Translation Keys**:
- Backend: `teamupAccepted`, `teamupAcceptedMessage`
- Frontend: `notifications.teamup_accepted`

**Example**:
- EN: "Your response to 'Need 2 players for Basketball' was accepted! Get ready for Basketball"
- FR: "Votre réponse à 'Besoin de 2 joueurs pour Basketball' a été acceptée ! Préparez-vous pour Basketball"

### 3. teamup_declined
**Trigger**: When a TeamUp request creator declines your application

**Recipients**: Person who applied to the request

**Parameters**:
- `title`: Title of the TeamUp request
- `sportType`: Type of sport (optional)

**Translation Keys**:
- Backend: `teamupDeclined`, `teamupDeclinedMessage`
- Frontend: `notifications.teamup_declined`

**Example**:
- EN: "Your response to 'Need 2 players for Basketball' was not accepted"
- FR: "Votre réponse à 'Besoin de 2 joueurs pour Basketball' n'a pas été acceptée"

## Database Schema

### TeamUpNotification Table

```sql
CREATE TABLE "TeamUpNotification" (
    id              TEXT        PRIMARY KEY,
    teamUpRequestId TEXT        NOT NULL,
    userId          TEXT        NOT NULL,
    type            TEXT        NOT NULL,
    params          JSONB,
    metadata        JSONB,
    createdAt       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read            BOOLEAN     NOT NULL DEFAULT false,
    
    FOREIGN KEY (teamUpRequestId) REFERENCES TeamUpRequest(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES User(id)
);
```

**Indexes**:
- `userId` - For fetching user notifications
- `teamUpRequestId` - For request-related queries
- `read` - For filtering unread notifications
- `userId, read` - Composite for unread user notifications
- `createdAt` - For chronological sorting

## API Integration

### Creating Notifications

Notifications are automatically created in the TeamUp controller:

```typescript
// When someone applies (respondToTeamUpRequest)
await prisma.teamUpNotification.create({
  data: {
    userId: teamUpRequest.creatorId,
    teamUpRequestId: id,
    type: 'teamup_response',
    params: {
      name: req.user.name,
      title: teamUpRequest.title,
      sportType: teamUpRequest.sportType
    },
    metadata: {
      responseId: response.id,
      responderId: req.user.id,
      responderName: req.user.name
    }
  }
});

// When creator accepts/declines (handleTeamUpResponse)
await prisma.teamUpNotification.create({
  data: {
    userId: response.userId,
    teamUpRequestId: id,
    type: action === 'accept' ? 'teamup_accepted' : 'teamup_declined',
    params: {
      title: teamUpRequest.title,
      sportType: teamUpRequest.sportType
    },
    metadata: {
      responseId: responseId,
      action: action,
      location: teamUpRequest.location,
      dateTime: teamUpRequest.dateTime
    }
  }
});
```

### Fetching Notifications

Use the unified notification service:

```typescript
import { getUserNotifications } from './services/notificationService';

// Get all notifications (includes TeamUp)
const { notifications, total } = await getUserNotifications(userId, {
  includeRead: false,
  limit: 50
});

// Get only TeamUp notifications
const { notifications, total } = await getUserNotifications(userId, {
  notificationType: 'teamup',
  includeRead: false
});
```

### Marking as Read

```typescript
import { markNotificationsAsRead } from './services/notificationService';

// Mark specific notifications
await markNotificationsAsRead(userId, [notificationId1, notificationId2]);

// Mark all as read
await markNotificationsAsRead(userId);
```

## Frontend Display

TeamUp notifications include metadata for enhanced display:

```typescript
{
  id: "notification-id",
  userId: "user-id",
  type: "teamup_response",
  notificationType: "teamup",
  params: {
    name: "John Doe",
    title: "Need 2 players",
    sportType: "basketball"
  },
  read: false,
  createdAt: "2024-01-10T...",
  metadata: {
    category: "teamup",
    priority: "medium",
    actionUrl: "/teamup/request-id",
    actionText: "Review Response"
  },
  teamUpRequest: {
    id: "request-id",
    title: "Need 2 players",
    sportType: "basketball"
  }
}
```

## Translation Files

### Backend (src/backend/utils/i18n.ts)
Contains server-side translations for emails and API responses.

### Frontend (src/frontend/src/locales/{en,fr}/translation.json)
Contains client-side translations under:
- `notifications.teamup_response`
- `notifications.teamup_accepted`
- `notifications.teamup_declined`
- `notifications.teamupNotifications`
- `notifications.teamup`

## Email Notifications

TeamUp notifications also trigger email notifications through the email queue system. The email templates include:
- Detailed information about the request
- Responder information (for teamup_response)
- Accept/decline status (for teamup_accepted/declined)
- Event details (sport type, date/time, location)

## Testing

To test the notification system:

1. Create a TeamUp request as User A
2. Apply to the request as User B
   - User A should receive a `teamup_response` notification
3. Accept the response as User A
   - User B should receive a `teamup_accepted` notification
4. Or decline the response as User A
   - User B should receive a `teamup_declined` notification

## Priority Levels

- **High**: `teamup_declined` (requires attention)
- **Medium**: `teamup_accepted`, `teamup_response` (actionable)
- **Low**: Default for other types

## Related Files

- `/prisma/schema.prisma` - Database schema
- `/src/backend/controllers/teamUpController.ts` - Controller logic
- `/src/backend/services/notificationService.ts` - Notification service
- `/src/backend/utils/i18n.ts` - Backend translations
- `/src/frontend/src/locales/en/translation.json` - English translations
- `/src/frontend/src/locales/fr/translation.json` - French translations
- `/prisma/migrations/20260110031914_add_teamup_notifications/` - Database migration
