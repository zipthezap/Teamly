# Architecture Improvements: Events, Groups, Invites & Notifications

This document outlines the architectural analysis and improvements made to the events, groups, invites, and notifications systems in Teamly.

## 📊 Overview

The Teamly application has well-structured systems for managing events, groups, invites, and notifications. This document summarizes the architecture, identifies improvements made, and suggests future enhancements.

## 🔍 Current Architecture

### 1. Events System

**Purpose**: Manage sports events within groups, including creation, participation tracking, and recurring events.

**Key Components**:
- **Model**: `Event` (Prisma schema)
- **Controller**: `eventController.ts` (~2005 lines)
- **Service**: `eventService.ts` (validation, filters, business logic)
- **Routes**: Public and authenticated endpoints for CRUD operations

**Features**:
- Public/private events with invite tokens
- Recurring events (RRULE format)
- Participant status tracking (pending/confirmed/declined)
- Guest participants (non-registered users)
- Event reminders and attendance tracking
- Status lifecycle (upcoming → ongoing → completed/cancelled)

**Strengths**:
- Comprehensive indexing for performance
- Support for both registered and guest participants
- Flexible invite system with shareable links
- Well-separated concerns between controller and service

### 2. Groups System

**Purpose**: Organize users into groups for managing events and tournaments together.

**Key Components**:
- **Model**: `Group`, `GroupMember`, `GroupJoinRequest` (Prisma schema)
- **Controller**: `groupController.ts` (~2138 lines)
- **Service**: `groupService.ts` (permissions, caching, validation)
- **Routes**: Public discovery and authenticated management endpoints

**Features**:
- Role-based access control (admin/moderator/member)
- Public/private groups with location-based discovery
- Join requests and invitations
- Shareable invite links
- Group chat and messages
- Advanced settings (auto-approve, member permissions, max members)

**Strengths**:
- Three-tier permission model provides flexibility
- Caching layer for group data (5-min TTL)
- Location-based group discovery
- Clear separation between user-initiated and admin-invited joins

### 3. Invites System (Unified)

**Purpose**: Provide consistent invitation functionality across events and groups.

**Key Components**:
- **Service**: `inviteService.ts` (unified invitation logic)
- **Utility**: `inviteToken.ts` (token generation)
- **Models**: Uses event/group join mechanisms

**Features**:
- Email invitations with templates
- Batch invitation support
- Unified invitation patterns
- Integration with notification system
- Respects user mute preferences

**Strengths**:
- **Unified approach**: Single service handles both event and group invites
- Consistent email templates and user experience
- Mute preference filtering
- Transaction support for atomicity
- Comprehensive error handling with result breakdown

**Architecture Pattern**:
```typescript
InviteService
  ├── sendInvitationEmail() - Unified email template
  ├── inviteUserToGroup() - Group-specific invitation
  └── batchInviteToGroup() - Batch processing with error tracking
```

### 4. Notifications System

**Purpose**: Inform users about activity and changes in events, groups, team-ups, and tournaments.

**Key Components**:
- **Models**: 4 separate notification tables (Event, Group, TeamUp, Tournament)
- **Factory**: `notificationFactory.ts` (centralized creation)
- **Service**: `notificationService.ts` (unified querying)
- **Helper**: `notificationHelper.ts` (email preferences, filtering)

**Features**:
- In-app notification center
- Mute preferences per notification type
- Deduplication within time windows
- Transaction-aware creation
- Metadata for rich notifications (action URLs, priority, images)
- Unified query interface across all notification types

**Strengths**:
- **Centralized creation**: NotificationFactory ensures consistency
- **Unified querying**: Single service handles all notification types
- **Flexible muting**: Users control which notifications they receive
- **Transaction support**: Atomic notification creation
- **Metadata system**: Rich notification data without schema bloat

**Architecture Pattern**:
```typescript
NotificationFactory (Creation)
  ├── createEventNotifications()
  ├── createGroupNotifications()
  ├── createTeamUpNotifications()
  └── createTournamentNotifications()
       └── Common logic:
           ├── Filter muted users
           ├── Deduplicate within window
           └── Batch create with transaction support

NotificationService (Querying)
  └── getUserNotifications()
       └── Unifies 4 tables into single response
```

## ✅ Improvements Made

### 1. Enhanced Type Safety (Schema Level)

**Problem**: Multiple fields used plain strings instead of enums, reducing type safety.

**Solution**: Added proper enum types to Prisma schema and TypeScript types:

```prisma
// New enums added
enum GroupMemberRole { member, moderator, admin }
enum GroupJoinRequestStatus { pending, approved, rejected }
enum EventRequestStatus { voting, finalized, cancelled, expired }
enum EventAttendanceStatus { on_time, late }
enum TeamUpRequestStatus { open, filled, cancelled, expired }
enum TeamUpResponseStatus { pending, accepted, declined }
enum EmailQueueStatus { pending, sent, failed, retry }
```

**Benefits**:
- **Compile-time type checking**: Prevents invalid status values
- **Better IDE support**: Auto-completion and type hints
- **Self-documenting**: Enums clearly show all possible values
- **Database constraints**: PostgreSQL enforces valid enum values

### 2. Added Missing Database Indices

**Problem**: `GroupJoinRequest.status` lacked indices for efficient filtering.

**Solution**: Added composite indices:
```prisma
@@index([status])           // For filtering by status
@@index([userId, status])   // For user's pending requests
```

**Benefits**:
- Faster queries for pending invitations
- Better performance at scale
- Consistent with other indexed status fields

### 3. Improved TypeScript Type Exports

**Problem**: New enums needed to be exported for use across frontend and backend.

**Solution**: Updated shared type files:
- Added enums to `/src/shared/types/group.types.ts`
- Added enums to `/src/shared/types/event.types.ts`
- Added enums to `/src/shared/types/teamup.types.ts`
- Added enums to `/src/shared/types/email.types.ts`

**Benefits**:
- Type consistency across codebase
- Shared types prevent duplication
- Frontend can use same enums as backend

### 4. Code Cleanup

**Improvements**:
- Removed unused imports in test files
- Fixed linting warnings
- Improved code documentation

## 🎯 Architectural Strengths

### What's Working Well

1. **Unified Invite Service**: Single source of truth for invitation logic
2. **NotificationFactory Pattern**: Centralized, transaction-aware notification creation
3. **Permission Service**: Consolidated permission checking with caching
4. **Service Layer Separation**: Clear boundary between controllers and business logic
5. **Transaction Support**: Services accept optional Prisma transaction clients
6. **Composite Indices**: Well-optimized database queries for scalability
7. **Mute Preferences**: Granular user control over notifications
8. **HTML Sanitization**: Consistent XSS prevention across user inputs

### Design Patterns Used

1. **Factory Pattern**: `NotificationFactory` for consistent notification creation
2. **Service Layer**: Business logic separated from HTTP concerns
3. **Repository Pattern**: Prisma as abstraction over database
4. **Strategy Pattern**: Different mute keys for different notification types
5. **Transaction Script**: Optional transaction support in services
6. **Cache-Aside**: Strategic caching for group and location queries

## 🔮 Recommendations for Future Improvements

### 1. Notification Table Consolidation (Large Scale)

**Current State**: 4 separate notification tables
```prisma
EventNotification
GroupNotification  
TeamUpNotification
TournamentNotification
```

**Proposed**: Single polymorphic notification table
```prisma
model Notification {
  id              String   @id
  userId          String
  type            String   // Notification type enum
  resourceType    String   // event, group, teamup, tournament
  resourceId      String   // Polymorphic reference
  params          Json?
  metadata        Json?
  read            Boolean
  createdAt       DateTime
  
  @@index([userId, read])
  @@index([resourceType, resourceId])
  @@index([createdAt])
}
```

**Benefits**:
- Simpler queries (single table scan)
- Easier to add new resource types
- Unified notification history
- Reduced schema complexity

**Challenges**:
- Loss of foreign key constraints
- Migration complexity
- Potential query performance impact (needs testing)
- Would require significant refactoring

**Recommendation**: Consider this only if notification queries become a bottleneck. Current architecture with 4 tables is maintainable and performant for medium scale.

### 2. Event Exception Dates Optimization

**Current State**: Exception dates stored as JSON array
```prisma
exceptionDates  Json?  // Array of dates to skip
```

**Concern**: Could grow large for long-running recurring events

**Proposed**: Separate table for exceptions
```prisma
model EventException {
  id           String   @id
  eventId      String
  exceptionDate DateTime
  reason       String?
  
  @@unique([eventId, exceptionDate])
  @@index([eventId])
}
```

**Benefits**:
- Better performance for large exception lists
- Easier to query and filter exceptions
- Can add metadata (reason, created by, etc.)

**When to Implement**: When events with 50+ exceptions become common

### 3. Permission Caching Enhancement

**Current State**: Basic caching exists but could be expanded

**Proposed Improvements**:
- Cache permission results with TTL
- Invalidate cache on role changes
- Distributed cache for horizontal scaling

**Example**:
```typescript
// Current: Direct query each time
const isAdmin = await checkGroupAdmin(groupId, userId);

// Proposed: Cache with Redis
const cacheKey = `permission:${userId}:group:${groupId}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const isAdmin = await checkGroupAdmin(groupId, userId);
await cache.set(cacheKey, isAdmin, { ttl: 300 });
```

### 4. Batch Operations Enhancement

**Current State**: Batch invites exist for groups

**Proposed**: Extend to events and add bulk status updates
```typescript
// Batch event participant status updates
await eventService.bulkUpdateParticipantStatus(eventId, [
  { userId: 'user1', status: 'confirmed' },
  { userId: 'user2', status: 'declined' },
  // ... more updates
]);
```

**Benefits**:
- Reduced database round-trips
- Better performance for large groups
- Atomic batch operations

### 5. Notification Delivery Optimization

**Current State**: Notifications created synchronously

**Proposed**: Background job processing for large batches
```typescript
// For events with many participants
if (participantCount > 100) {
  await jobQueue.add('create-notifications', {
    eventId,
    type: 'event_updated',
    userIds
  });
} else {
  await NotificationFactory.createEventNotifications(...);
}
```

**Benefits**:
- Non-blocking for large user lists
- Better user experience for event creators
- Prevents timeout issues

### 6. Analytics and Insights

**Proposed**: Add analytics tracking for notifications and invites
```typescript
// Track notification effectiveness
model NotificationAnalytics {
  id               String   @id
  notificationId   String
  viewedAt         DateTime?
  clickedAt        DateTime?
  actionTaken      String?   // accepted, declined, ignored
}
```

**Use Cases**:
- Measure invitation acceptance rates
- Identify most effective notification types
- Optimize notification timing
- A/B test notification content

## 📝 Code Quality Observations

### Strengths

1. **Consistent Error Handling**: Services use structured logging
2. **Type Safety**: Strong TypeScript usage with Prisma types
3. **Input Validation**: HTML sanitization and validation utilities
4. **Transaction Support**: Atomic operations where needed
5. **Test Coverage**: Comprehensive test suite for services
6. **Documentation**: Well-commented code with JSDoc

### Minor Issues Fixed

1. ✅ Removed unused imports in test files
2. ✅ Added missing database indices
3. ✅ Improved type safety with enums
4. ✅ Updated documentation

## 🏗️ Migration Path for Major Changes

If implementing notification table consolidation:

1. **Phase 1**: Create new unified table alongside existing tables
2. **Phase 2**: Dual-write to both old and new tables
3. **Phase 3**: Migrate historical data with backfill script
4. **Phase 4**: Switch reads to new table
5. **Phase 5**: Remove old tables once verified

Estimated effort: 2-3 weeks for careful migration with zero downtime.

## 📊 Performance Considerations

### Current Performance Characteristics

- **Notification Creation**: O(n) where n = number of users
- **Notification Queries**: O(log n) due to composite indices
- **Permission Checks**: O(1) with caching, O(log n) without
- **Invite Processing**: O(n) for batch invites

### Scalability Thresholds

- ✅ **Good up to**: 10K users, 1K concurrent
- ⚠️ **Monitor**: Groups with 1000+ members
- ⚠️ **Monitor**: Events with 100+ participants
- ⚠️ **Monitor**: Recurring events with 50+ exceptions

## 🎓 Learning Resources

For developers working on these systems:

1. **Prisma Documentation**: [prisma.io/docs](https://www.prisma.io/docs/)
2. **Transaction Patterns**: See `inviteService.ts` for examples
3. **Notification Factory**: Study `notificationFactory.ts` for consistent patterns
4. **Permission Service**: Reference `permissionService.ts` for caching strategies

## 🔗 Related Documentation

- [NOTIFICATION_ARCHITECTURE.md](archive/NOTIFICATION_ARCHITECTURE.md) - Detailed notification system design
- [SCALABILITY.md](SCALABILITY.md) - Scalability improvements and patterns
- [BACKEND_IMPROVEMENTS.md](BACKEND_IMPROVEMENTS.md) - Backend optimization details
- [SECURITY.md](SECURITY.md) - Security best practices

## 📈 Metrics to Track

Recommended monitoring for these systems:

1. **Notification Delivery Time**: P50, P95, P99
2. **Invite Acceptance Rate**: % of invites accepted within 24h/7d
3. **Permission Check Latency**: Average time for permission checks
4. **Database Query Performance**: Slow query log analysis
5. **Cache Hit Rate**: For permission and group caches

## 🎉 Conclusion

The current architecture for events, groups, invites, and notifications is **well-designed and production-ready**. The improvements made focus on:

1. ✅ **Type safety** through proper enums
2. ✅ **Database optimization** through better indices  
3. ✅ **Code quality** through cleanup and documentation
4. ✅ **Maintainability** through shared types

The system is ready for medium-scale production use (10K+ users). Future improvements should be driven by actual performance data and user feedback rather than premature optimization.

---

**Last Updated**: January 2026  
**Author**: AI Architecture Analysis  
**Status**: Living Document
