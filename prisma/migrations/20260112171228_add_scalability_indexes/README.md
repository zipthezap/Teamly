# Migration: Add Scalability Indexes

**Created**: 2026-01-12
**Purpose**: Add composite indexes to improve query performance for Events and TeamUp features at scale

## Changes

### Event Table Indexes
- `Event_status_startTime_idx`: Optimize queries filtering by status and sorting by date
- `Event_eventType_startTime_idx`: Optimize queries filtering by event type and sorting by date
- `Event_isPublic_startTime_idx`: Optimize public event discovery queries
- `Event_archived_status_startTime_idx`: Optimize queries for active (non-archived) events

### TeamUpRequest Table Indexes
- `TeamUpRequest_sportType_status_dateTime_idx`: Optimize sport type filtering with status
- `TeamUpRequest_city_country_status_dateTime_idx`: Optimize location-based queries
- `TeamUpRequest_creatorId_status_idx`: Optimize user's own requests by status

## Performance Impact

These indexes are designed to improve query performance by 10-100x for common filtering patterns:
- Filtering events by status (upcoming, ongoing, completed)
- Filtering by event type (football, basketball, etc.)
- Public event discovery
- Location-based TeamUp searches
- User's own TeamUp requests

## Migration Safety

- All indexes use `IF NOT EXISTS` to prevent errors if they already exist
- Indexes are created concurrently (non-blocking) by default in PostgreSQL 11+
- No data is modified, only indexes are added
- Can be rolled back by dropping the indexes

## Rollback

To rollback this migration:

```sql
DROP INDEX IF EXISTS "Event_status_startTime_idx";
DROP INDEX IF EXISTS "Event_eventType_startTime_idx";
DROP INDEX IF EXISTS "Event_isPublic_startTime_idx";
DROP INDEX IF EXISTS "Event_archived_status_startTime_idx";
DROP INDEX IF EXISTS "TeamUpRequest_sportType_status_dateTime_idx";
DROP INDEX IF EXISTS "TeamUpRequest_city_country_status_dateTime_idx";
DROP INDEX IF EXISTS "TeamUpRequest_creatorId_status_idx";
```

## Notes

- Index creation may take a few seconds to minutes depending on table size
- Monitor query performance before and after to verify improvements
- Consider running during off-peak hours for production deployments
