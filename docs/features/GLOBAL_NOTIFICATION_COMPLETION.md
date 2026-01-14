# Global Notification System Completion

This document describes the completed global notification system covering TeamUp posts and Tournament registrations.

## Changes Made

### 1. Database Schema Updates

#### New TeamUp Notification Type
Added `teamup_comment` to the `TeamUpNotificationType` enum to notify TeamUp post creators when someone comments on their post.

#### New Tournament Notification Model
Created a new `TournamentNotification` model with the following notification types:
- `team_registered` - Notifies organizer when a team registers for their tournament
- `tournament_updated` - For future use when tournament details are updated
- `tournament_cancelled` - For future use when tournament is cancelled
- `match_scheduled` - For future use when matches are scheduled
- `score_submitted` - For future use when scores are submitted

### 2. Backend Implementation

#### Notification Service Updates (`src/backend/services/notificationService.ts`)
- Extended `UnifiedNotification` interface to include tournament notifications
- Updated `getUserNotifications()` to fetch and merge tournament notifications
- Enhanced `enrichNotificationMetadata()` to handle tournament and teamup_comment types
- Updated `markNotificationsAsRead()` to include tournament notifications
- Modified `getNotificationStats()` to count tournament notifications
- Updated delete functions to handle tournament notifications

#### TeamUp Comment Notifications (`src/backend/controllers/teamUpController.ts`)
When a user adds a comment to a TeamUp post:
- Creates a notification for the TeamUp post creator (unless the commenter is the creator)
- Includes commenter name, post title, and sport type in notification
- Stores metadata about the comment and commenter for reference

#### Tournament Registration Notifications (`src/backend/controllers/tournamentController.ts`)
When a team registers for a tournament:
- Creates a notification for the tournament organizer (unless the registrant is the organizer)
- Includes tournament name, team name, and captain name in notification
- Stores metadata about the team and who registered it

### 3. TypeScript Type Updates

Updated shared types:
- `src/shared/types/event.types.ts` - Added `teamup_comment` to `TeamUpNotificationType`
- `src/shared/types/tournament.types.ts` - Added `TournamentNotificationType` enum

### 4. Database Migration

Created migration `20260114150243_add_tournament_notifications_and_teamup_comment_type` that:
- Adds `teamup_comment` value to `TeamUpNotificationType` enum
- Creates `TournamentNotificationType` enum
- Creates `TournamentNotification` table with proper indexes and foreign keys

## Notification Flow

### TeamUp Comment Notification
1. User adds comment to a TeamUp post
2. System checks if commenter is not the post creator
3. Creates notification with type `teamup_comment`
4. Notification appears in creator's notification center with:
   - Priority: Medium
   - Action: "View Comment"
   - Link to TeamUp post

### Tournament Registration Notification
1. Team registers for a tournament
2. System checks if registrant is not the organizer
3. Creates notification with type `team_registered`
4. Notification appears in organizer's notification center with:
   - Priority: Medium
   - Action: "View Team"
   - Link to tournament page

## Notification Priority Levels

- **High**: `tournament_cancelled`, `teamup_declined`, `late`, `declined`, `cancelled`
- **Medium**: `team_registered`, `teamup_comment`, `teamup_accepted`, `teamup_response`, `join`, `accepted`, `created`, `score_submitted`
- **Low**: All other notification types

## Testing

To test the new notifications:

### TeamUp Comment Notifications
1. Create a TeamUp post as User A
2. Login as User B and comment on User A's post
3. Login as User A and check notifications - should see "User B commented on your TeamUp post"

### Tournament Registration Notifications
1. Create a tournament as User A
2. Login as User B and register a team
3. Login as User A and check notifications - should see "Team [name] registered for your tournament"

## API Endpoints

The existing notification endpoints now handle tournament notifications:

- `GET /api/notifications` - Returns all notifications including tournament
- `GET /api/notifications/stats` - Includes tournament notification counts
- `PUT /api/notifications/read` - Marks tournament notifications as read
- `DELETE /api/notifications` - Deletes tournament notifications

### New Query Parameters
- `notificationType=tournament` - Filter to show only tournament notifications

## Future Enhancements

The notification system is now set up to easily add:
- Tournament update notifications (`tournament_updated`)
- Tournament cancellation notifications (`tournament_cancelled`)
- Match scheduling notifications (`match_scheduled`)
- Score submission notifications (`score_submitted`)

## Notes

- All notifications follow the existing notification patterns
- Notification metadata includes priority levels for UI display
- Action URLs point to relevant pages for quick navigation
- Notifications are only created when the action is performed by a different user
- All notification operations are wrapped in try-catch to prevent failures from affecting main operations
