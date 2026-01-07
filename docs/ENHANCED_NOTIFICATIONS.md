# Enhanced Notification System

This document describes the significantly improved notification system in Teamly.

## Overview

The notification system has been completely enhanced to provide users with a comprehensive, feature-rich notification experience including:

- **Persistent Notification History**: All notifications are preserved with full history
- **Advanced Filtering**: Filter by type, date range, read/unread status
- **Rich Metadata**: Notifications include priority levels, action buttons, and contextual information
- **Real-time Updates**: Auto-refresh notifications every 30 seconds
- **Notification Statistics**: Track unread counts, notification types, and activity trends
- **Comprehensive UI**: Dedicated notification center with search and pagination

## Key Features

### 1. Enhanced Backend API

#### New Endpoints

**GET /api/notifications**
- Get all notifications with advanced filtering
- Query parameters:
  - `includeRead`: boolean (default: false) - Include read notifications
  - `limit`: number (default: 50, max: 100) - Results per page
  - `offset`: number (default: 0) - Pagination offset
  - `type`: string - Filter by notification type (join, leave, created, etc.)
  - `notificationType`: 'event' | 'group' - Filter by category
  - `startDate`: ISO date string - Filter from date
  - `endDate`: ISO date string - Filter to date

**PUT /api/notifications/read**
- Mark notifications as read
- Body: `{ notificationIds?: string[] }` - Array of IDs to mark, or omit to mark all

**GET /api/notifications/stats**
- Get comprehensive notification statistics
- Returns:
  - Unread counts (total, event, group)
  - Total counts (total, event, group)
  - Last 7 days activity
  - Type distribution

**GET /api/notifications/unread-count**
- Quick endpoint for badge counts
- Returns: `{ count, eventCount, groupCount }`

### 2. Rich Notification Metadata

Each notification now includes:

```typescript
{
  id: string;
  title: string;           // Human-readable title
  message: string;         // Detailed message
  type: string;           // Specific type (join, leave, etc.)
  notificationType: 'event' | 'group';
  read: boolean;
  createdAt: Date;
  metadata: {
    actionUrl?: string;   // URL to navigate to
    actionText?: string;  // Button text
    category?: string;    // Classification
    priority?: 'low' | 'medium' | 'high';
    relatedUserId?: string;
    relatedUserName?: string;
  }
}
```

### 3. Notification Priorities

Notifications are automatically classified by priority:

- **High Priority**: late, declined, cancelled
- **Medium Priority**: join, accepted, created
- **Low Priority**: Other notification types

### 4. Auto-Generated Titles and Messages

The system automatically generates human-readable titles and messages based on notification type:

**Event Notifications:**
- "John joined your event" (type: join)
- "Sarah will be late" (type: late)
- "New Event: Weekly Football" (type: created)

**Group Notifications:**
- "New Join Request" (type: join_request)
- "Join Request Accepted" (type: accepted)
- "New Group Near You" (type: nearby_created)

### 5. Frontend Components

#### Enhanced Notification Popover
Located in: `src/frontend/src/components/NotificationsPopover.tsx`

Features:
- Shows unread notification count with badge
- Real-time auto-refresh every 30 seconds
- Stats chips showing event/group counts
- Priority indicators with colored chips
- Click to navigate to related content
- Mark all as read button
- View all button to open Notification Center

#### Notification Center Page
Located in: `src/frontend/src/pages/NotificationsCenter.tsx`

Features:
- **Tabs**: Unread, Events, Groups, All
- **Search**: Full-text search across titles and messages
- **Filters**: Filter by notification type
- **Statistics Cards**: Visual dashboard showing unread counts
- **Pagination**: Load more with infinite scroll
- **Smart Timestamps**: Shows "Just now", "5m ago", "2h ago", etc.
- **Visual Indicators**: 
  - Unread notifications highlighted
  - Priority badges
  - Type chips
- **Quick Actions**: Click to navigate to event/group

#### Enhanced Notifications Hook
Located in: `src/frontend/src/hooks/useEnhancedNotifications.ts`

Features:
- Auto-refresh with configurable interval
- Advanced filtering (type, date, read status)
- Pagination support
- Statistics tracking
- Mark as read functionality
- Loading states and error handling

### 6. Unified Notification Service
Located in: `src/backend/services/notificationService.ts`

This service provides:
- Centralized notification retrieval
- Metadata enrichment
- Title/message generation
- Statistics calculation
- Batch read operations

## Usage Examples

### Backend API Examples

#### Get All Unread Notifications
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/notifications
```

#### Get Event Notifications from Last Week
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/notifications?notificationType=event&startDate=2024-01-01T00:00:00Z&includeRead=true"
```

#### Mark Specific Notifications as Read
```bash
curl -X PUT -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notificationIds":["notif-1","notif-2"]}' \
  http://localhost:3000/api/notifications/read
```

#### Get Notification Statistics
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/notifications/stats
```

### Frontend Examples

#### Using the Enhanced Hook
```typescript
import { useEnhancedNotifications } from '../hooks/useEnhancedNotifications';

function MyComponent() {
  const {
    notifications,
    stats,
    loading,
    filters,
    hasMore,
    total,
    markAsRead,
    loadMore,
    refresh,
    updateFilters,
    clearFilters,
  } = useEnhancedNotifications({
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    initialFilters: { includeRead: false },
  });

  // Filter by event type
  const handleFilterEvents = () => {
    updateFilters({ notificationType: 'event' });
  };

  // Mark notification as read when clicked
  const handleClick = async (notif) => {
    await markAsRead([notif.id]);
    // Navigate or perform action
  };

  return (
    <div>
      <div>Unread: {stats?.unread}</div>
      {notifications.map(notif => (
        <div key={notif.id} onClick={() => handleClick(notif)}>
          {notif.title}
        </div>
      ))}
      {hasMore && <button onClick={loadMore}>Load More</button>}
    </div>
  );
}
```

#### Using Unread Count Hook
```typescript
import { useUnreadCount } from '../hooks/useEnhancedNotifications';

function NotificationBadge() {
  const { count, loading, refresh } = useUnreadCount();
  
  return <Badge badgeContent={count}><NotificationsIcon /></Badge>;
}
```

## Implementation Details

### Notification Flow

1. **Creation**: When an event occurs (user joins event, etc.), a notification record is created in the database
2. **Enrichment**: The notification service automatically adds:
   - Human-readable title and message
   - Priority level
   - Action URL and text
   - Category and metadata
3. **Retrieval**: Frontend fetches notifications via API with optional filters
4. **Display**: Notifications appear in popover and notification center
5. **Auto-refresh**: Frontend polls for new notifications every 30 seconds
6. **Mark as Read**: When user interacts with notification, it's marked as read
7. **History**: All notifications are preserved for historical access

### Database Schema

The system uses existing `EventNotification` and `GroupNotification` tables with enhanced querying:

```prisma
model EventNotification {
  id        String   @id @default(uuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String   // join, leave, late, etc.
  createdAt DateTime @default(now())
  read      Boolean  @default(false)
}

model GroupNotification {
  id        String   @id @default(uuid())
  groupId   String
  group     Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String   // join_request, accepted, etc.
  createdAt DateTime @default(now())
  read      Boolean  @default(false)
}
```

## Performance Considerations

1. **Pagination**: Default limit of 50, max 100 to prevent large data transfers
2. **Indexing**: Queries filtered on userId and read status should be indexed
3. **Auto-refresh**: 30-second interval balances freshness with server load
4. **Lazy Loading**: Notification Center loads more as user scrolls
5. **Caching**: Frontend caches notification stats between refreshes

## Benefits Over Previous System

### Before
- ❌ Only showed unread notifications
- ❌ No notification history
- ❌ Basic titles without context
- ❌ No filtering or search
- ❌ No statistics or insights
- ❌ Manual refresh required
- ❌ No priority indicators
- ❌ Limited metadata

### After
- ✅ Complete notification history with read/unread
- ✅ Advanced filtering (type, date, category)
- ✅ Full-text search
- ✅ Rich titles and messages with context
- ✅ Comprehensive statistics dashboard
- ✅ Auto-refresh every 30 seconds
- ✅ Priority indicators (high/medium/low)
- ✅ Action buttons for quick navigation
- ✅ Dedicated notification center page
- ✅ Notification grouping by type/date
- ✅ Pagination and infinite scroll
- ✅ Smart timestamps (relative time)

## Future Enhancements

Potential improvements for future versions:

1. **Real-time WebSockets**: Instant notification delivery without polling
2. **Push Notifications**: Browser push notifications for desktop
3. **Notification Preferences**: Fine-grained control per notification type
4. **Batch Actions**: Select multiple notifications for bulk operations
5. **Notification Templates**: Customizable notification templates
6. **Export**: Export notification history to CSV/JSON
7. **Analytics**: Detailed notification engagement analytics
8. **Smart Grouping**: Group related notifications (e.g., "5 people joined your event")
9. **Snooze**: Temporarily hide notifications
10. **Archive**: Archive old notifications

## Troubleshooting

### No Notifications Appearing

1. Check that notifications are being created in database
2. Verify user has proper permissions
3. Check browser console for API errors
4. Ensure auto-refresh is enabled

### Auto-refresh Not Working

1. Check that `autoRefresh` option is set to `true`
2. Verify `refreshInterval` is set (default 30000ms)
3. Check browser console for JavaScript errors
4. Ensure component is mounted and not unmounted

### Performance Issues

1. Reduce `refreshInterval` if too frequent
2. Lower `limit` parameter if fetching too many at once
3. Enable pagination for large notification histories
4. Check database indexes on userId and read fields

## API Reference Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET | Get filtered notifications |
| `/api/notifications/read` | PUT | Mark as read |
| `/api/notifications/stats` | GET | Get statistics |
| `/api/notifications/unread-count` | GET | Get unread count |

## Testing

To test the notification system:

1. **Backend**: Start the server with `npm start`
2. **Create Test Notifications**: Join/leave events, create groups
3. **Check API**: Use curl or Postman to test endpoints
4. **Frontend**: Navigate to `/notifications` to see Notification Center
5. **Popover**: Click notification bell icon in navbar
6. **Auto-refresh**: Wait 30 seconds to see notifications update

## Support

For issues or questions about the enhanced notification system:
- Check API logs for backend errors
- Check browser console for frontend errors  
- Review this documentation for usage examples
- Check database for notification records

---

**Version**: 1.0.0  
**Last Updated**: January 2026
