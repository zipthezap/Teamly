# Backend Performance Improvements - Round 2

## Overview

This document outlines the performance improvements implemented in the second round of backend optimizations. These changes focus on reducing database load, improving response times, and enhancing overall code quality.

## Key Improvements

### 1. Strategic Caching (Phase 1)

#### Redis/In-Memory Caching
- **Groups Endpoints**: Added caching with 1-2 minute TTL
  - `getGroups`: 2 minutes cache, with optional event loading via query parameter
  - `getGroup`: 1 minute cache per user
- **Events Endpoints**: Added caching with 30 second TTL for simple queries
  - Cache key based on user, group, limit, offset
  - Only caches queries without complex filters to avoid stale data

#### Cache Invalidation
- Automatic cache invalidation on mutations:
  - Event create/update/delete invalidates events cache
  - Group member add/remove invalidates group and user caches
  - Pattern-based cache deletion for efficient cleanup

#### Query Optimization
- **Conditional Event Loading**: Groups endpoint only loads events when `includeEvents=true`
- **Event Limits**: Reduced event count to 20 per group, last 30 days only
- **Field Projections**: Use `_count` for totals instead of loading full relations
- **Pagination**: Proper limits and offsets on all list endpoints

### 2. Database Performance (Phase 2)

#### Query Monitoring
- Added middleware to track query performance per request
- Thresholds:
  - **Warning**: Queries > 1 second
  - **Error**: Queries > 3 seconds
  - **N+1 Detection**: > 50 queries per request
- Logs include query count, duration, and slow query details

#### Batch Operations
- Replaced `Promise.all(create)` with `createMany` for notifications
- Benefits:
  - Single database round-trip instead of N
  - Better transaction handling
  - Reduced connection pool pressure

#### Connection Pool Statistics
- Track pool usage: total, idle, waiting connections
- Helps identify connection exhaustion issues
- Configurable via environment variables

### 3. Response Optimization (Phase 3)

#### HTTP Caching
- **ETag Support**: Added to all read-heavy endpoints
  - Groups: GET /api/groups, GET /api/groups/:id
  - Events: GET /api/events, GET /api/events/:id, etc.
  - Uses weak ETags for efficient comparison
- **Cache-Control Headers**: Already configured with appropriate TTLs
  - Private caching for user-specific data
  - Stale-while-revalidate for better UX

#### Export Optimization
- Selective field projections in export queries
- Only load current user's participant status
- Use `_count` for participant totals
- Streaming utilities available for large exports

#### Compression
- Gzip compression with optimal settings:
  - 1KB threshold (skip small responses)
  - Level 6 (balanced speed/ratio)
  - Automatic content-type filtering

## Performance Metrics

### Expected Improvements

1. **Response Time**
   - Groups list: ~40-60% faster (cached)
   - Events list: ~30-50% faster (cached + optimized query)
   - Export: ~20-30% faster (selective fields)

2. **Database Load**
   - ~50% reduction in notification queries (batch operations)
   - ~30% reduction in group/event queries (caching)
   - Better connection pool utilization

3. **Network Bandwidth**
   - ~20-40% reduction (compression + ETags)
   - Fewer unnecessary data transfers (304 responses)
   - Smaller payloads (selective projections)

## Configuration

### Environment Variables

```bash
# Database Connection Pool
DB_POOL_MAX=20              # Maximum connections (default: 20)
DB_POOL_MIN=2               # Minimum connections (default: 2)
DB_IDLE_TIMEOUT_MS=30000    # Idle connection timeout (default: 30s)
DB_CONNECTION_TIMEOUT_MS=5000 # Connection acquisition timeout (default: 5s)
DB_QUERY_TIMEOUT_MS=30000   # Query timeout (default: 30s)

# Cache Configuration
CACHE_MAX_SIZE=10000        # In-memory cache size (default: 10000)
REDIS_URL=                  # Optional Redis URL for distributed caching

# Performance Monitoring
SLOW_REQUEST_THRESHOLD_MS=3000 # Log requests slower than this (default: 3s)
```

## Monitoring

### Query Performance
Monitor the application logs for:
- Slow query warnings (>1s)
- Very slow query errors (>3s)
- High query count warnings (>50 per request)

### Cache Effectiveness
Check metrics for:
- Cache hit rate (should be >60% for groups/events)
- Cache miss patterns
- Invalidation frequency

### Connection Pool
Monitor for:
- Pool exhaustion (waiting connections)
- Idle connection ratio
- Average connection lifetime

## Best Practices

### When to Use Caching

**Do cache:**
- List endpoints with stable data (groups, events)
- Read-heavy endpoints
- Expensive computed values
- Aggregations and statistics

**Don't cache:**
- Real-time data (notifications, messages)
- User-specific sensitive data without proper isolation
- Data that changes frequently (every few seconds)

### Cache Invalidation

**Invalidate on:**
- Data mutations (create, update, delete)
- Relationship changes (member add/remove)
- Status changes affecting visibility

**Strategies:**
- Pattern-based deletion for related caches
- TTL for automatic expiration
- Manual invalidation for critical paths

### Query Optimization

**Guidelines:**
- Use `select` instead of `include` when possible
- Add `_count` for totals instead of loading relations
- Filter relations to minimal required data
- Use indexes for WHERE, ORDER BY, JOIN columns
- Limit query results appropriately

## Future Improvements

1. **Read Replicas**: Route read queries to replicas
2. **Query Result Caching**: Cache expensive query results at database level
3. **Incremental Loading**: Implement cursor-based pagination everywhere
4. **Background Jobs**: Move heavy operations to background workers
5. **API Response Compression**: Brotli compression for better ratios
6. **Database Query Plan Analysis**: Regular EXPLAIN analysis of slow queries

## Testing

To validate the improvements:

1. **Load Testing**
   ```bash
   # Before optimization baseline
   ab -n 1000 -c 10 http://localhost:3000/api/groups
   
   # After optimization
   ab -n 1000 -c 10 http://localhost:3000/api/groups
   ```

2. **Cache Hit Rate**
   - Check logs for cache hit/miss ratio
   - Should see >60% hit rate after warmup

3. **Query Count**
   - Monitor query logs for N+1 issues
   - Should see reduced query count per request

4. **Response Size**
   - Compare response payloads before/after
   - Should see smaller responses with selective fields

## Rollback Plan

If issues arise:
1. Disable caching: Set REDIS_URL to empty
2. Revert batch operations: Deploy previous version
3. Monitor logs for errors and performance degradation

## Support

For issues or questions:
- Check application logs for errors
- Review Prometheus metrics if available
- Check database connection pool status
- Monitor Redis connectivity if using distributed cache
