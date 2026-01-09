# Enhanced Notification System - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ENHANCED NOTIFICATION SYSTEM                               │
│                              Architecture Overview                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    USER ACTIONS
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
            ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
            │ Join Event    │   │ Create Group  │   │ Mark Late     │
            │ Leave Event   │   │ Accept Request│   │ Confirm Event │
            └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
                    │                    │                    │
                    └────────────────────┼────────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                             DATABASE LAYER                                      │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐    │
│  │   EventNotification Table        │  │   GroupNotification Table        │    │
│  │  ┌───────────────────────────┐  │  │  ┌───────────────────────────┐  │    │
│  │  │ id, type, userId, eventId │  │  │  │ id, type, userId, groupId │  │    │
│  │  │ createdAt, read           │  │  │  │ createdAt, read           │  │    │
│  │  └───────────────────────────┘  │  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘  └─────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED NOTIFICATION SERVICE                             │
│  Location: src/backend/services/notificationService.ts                         │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │ getUserNotifications()                                              │  │   │
│  │  │  • Fetch from both EventNotification and GroupNotification         │  │   │
│  │  │  • Apply filters (type, date, read status, category)               │  │   │
│  │  │  • Enrich with metadata (priority, actions, titles)                │  │   │
│  │  │  • Merge and sort by date                                          │  │   │
│  │  │  • Return paginated results                                        │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │ enrichNotificationMetadata()                                        │  │   │
│  │  │  • Add priority (high/medium/low)                                  │  │   │
│  │  │  • Add action URLs (/events/:id, /groups/:id)                     │  │   │
│  │  │  • Add action text ("View Event", "Review Request")               │  │   │
│  │  │  • Add category classification                                     │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │ generateNotificationTitle() & generateNotificationMessage()         │  │   │
│  │  │  • Create human-readable titles                                    │  │   │
│  │  │  • Generate contextual messages                                    │  │   │
│  │  │  • Include user names and event/group details                     │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │ getNotificationStats()                                              │  │   │
│  │  │  • Calculate unread counts                                         │  │   │
│  │  │  • Count by type and category                                      │  │   │
│  │  │  • Aggregate last 7 days activity                                  │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                           API ENDPOINTS (REST)                                  │
│  Location: src/backend/routes/notificationRoutes.ts                           │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  GET    /api/notifications              → Get filtered notifications   │   │
│  │         ?includeRead=false                                             │   │
│  │         &limit=50&offset=0                                             │   │
│  │         &type=join&notificationType=event                              │   │
│  │         &startDate=2024-01-01&endDate=2024-12-31                      │   │
│  │                                                                         │   │
│  │  PUT    /api/notifications/read         → Mark as read                │   │
│  │         Body: { notificationIds: [...] }                               │   │
│  │                                                                         │   │
│  │  GET    /api/notifications/stats        → Get statistics              │   │
│  │         Returns: unread, total, typeCounts, etc.                       │   │
│  │                                                                         │   │
│  │  GET    /api/notifications/unread-count → Quick badge count           │   │
│  │         Returns: { count, eventCount, groupCount }                     │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND LAYER                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │                     useEnhancedNotifications Hook                       │   │
│  │  Location: src/frontend/src/hooks/useEnhancedNotifications.ts          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │ Features:                                                          │  │   │
│  │  │  • Auto-refresh every 30 seconds                                  │  │   │
│  │  │  • Configurable filters                                           │  │   │
│  │  │  • Pagination support                                             │  │   │
│  │  │  • Loading & error states                                         │  │   │
│  │  │  • Mark as read functionality                                     │  │   │
│  │  │  • Statistics tracking                                            │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌──────────────────────────────┬──────────────────────────────────────────┐  │
│  │                              │                                          │  │
│  │  NotificationsPopover        │    NotificationsCenter Page              │  │
│  │  (Navbar component)          │    (Full-page view)                      │  │
│  │  ┌────────────────────────┐  │    ┌────────────────────────────────┐  │  │
│  │  │ • Badge with count     │  │    │ • Stats Dashboard (3 cards)   │  │  │
│  │  │ • Auto-refresh icon    │  │    │ • Tab Navigation              │  │  │
│  │  │ • Quick notification   │  │    │ • Search Bar                  │  │  │
│  │  │   list (last 5-10)     │  │    │ • Advanced Filters            │  │  │
│  │  │ • Stats chips          │  │    │ • Full notification list      │  │  │
│  │  │ • Priority badges      │  │    │ • Infinite scroll             │  │  │
│  │  │ • Mark all read button │  │    │ • Smart timestamps            │  │  │
│  │  │ • View All button      │  │    │ • Type/Priority badges        │  │  │
│  │  └────────────────────────┘  │    └────────────────────────────────┘  │  │
│  │           │                   │                   │                     │  │
│  └───────────┼───────────────────┴───────────────────┼─────────────────────┘  │
│              │                                       │                         │
│              └───────────────────┬───────────────────┘                         │
│                                  │                                             │
│                                  ▼                                             │
│                     ┌────────────────────────────┐                             │
│                     │   Click Notification       │                             │
│                     │   • Mark as read (auto)    │                             │
│                     │   • Navigate to actionUrl  │                             │
│                     └────────────────────────────┘                             │
└────────────────────────────────────────────────────────────────────────────────┘

                                 DATA FLOW EXAMPLE

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. User joins event                                                         │
│    ↓                                                                        │
│ 2. EventNotification created in database                                   │
│    {                                                                        │
│      type: 'join',                                                          │
│      userId: organizer-id,                                                  │
│      eventId: event-id,                                                     │
│      read: false                                                            │
│    }                                                                        │
│    ↓                                                                        │
│ 3. Frontend auto-refreshes (30 sec later)                                  │
│    ↓                                                                        │
│ 4. API fetches and enriches:                                               │
│    {                                                                        │
│      title: "John joined your event",                                      │
│      message: "John has joined 'Weekly Football'",                         │
│      metadata: {                                                            │
│        priority: 'medium',                                                  │
│        actionUrl: '/events/event-id',                                       │
│        actionText: 'View Event'                                             │
│      }                                                                      │
│    }                                                                        │
│    ↓                                                                        │
│ 5. Displayed in popover with:                                              │
│    • Badge showing '1' new notification                                    │
│    • Priority chip 'medium'                                                 │
│    • Highlighted as unread                                                  │
│    ↓                                                                        │
│ 6. User clicks notification:                                               │
│    • Marked as read                                                         │
│    • Navigates to /events/event-id                                         │
│    • Badge count decreases                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                              KEY IMPROVEMENTS

┌─────────────────────────────────────────────────────────────────────────────┐
│ Before:                          │  After:                                  │
│ • Manual refresh                 │  • Auto-refresh every 30 seconds         │
│ • Unread only                    │  • Full history with read/unread         │
│ • No filtering                   │  • 6 filter types                        │
│ • No search                      │  • Full-text search                      │
│ • Basic display                  │  • Rich metadata & priorities            │
│ • No statistics                  │  • 8 different statistics                │
│ • 1 UI component                 │  • 2 UI components (popover + page)      │
│ • No pagination                  │  • Infinite scroll pagination            │
└─────────────────────────────────────────────────────────────────────────────┘
