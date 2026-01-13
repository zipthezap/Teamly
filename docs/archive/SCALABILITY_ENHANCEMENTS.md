# Backend Scalability and Reliability Enhancements

This document describes the scalability and reliability improvements added to the Teamly backend.

## Overview

These improvements enhance the backend's ability to handle high load, recover from failures, and provide better observability. All features are designed to be:

- **Backwards compatible** - No breaking changes to existing functionality
- **Gracefully degrading** - System continues to function even if optional features fail
- **Production-ready** - Thoroughly tested and documented
- **Observable** - Comprehensive logging and metrics

## 1. Circuit Breaker Pattern

### Purpose
Prevents cascading failures by failing fast when external services are unavailable.

### Location
`src/backend/utils/circuitBreaker.ts`

### States
- **CLOSED**: Normal operation, all requests pass through
- **OPEN**: Service is down, requests fail immediately without attempting
- **HALF_OPEN**: Testing if service has recovered

### Pre-configured Circuit Breakers

#### Email Service Circuit Breaker
```typescript
import { emailCircuitBreaker } from '../utils/circuitBreaker';

await emailCircuitBreaker.execute(async () => {
  await sendEmail(recipient, subject, content);
});
```

Configuration:
- Failure threshold: 5 failures
- Reset timeout: 60 seconds
- Half-open test requests: 2

#### Redis Circuit Breaker
```typescript
import { redisCircuitBreaker } from '../utils/circuitBreaker';

await redisCircuitBreaker.execute(async () => {
  return await redis.get(key);
});
```

Configuration:
- Failure threshold: 3 failures
- Reset timeout: 30 seconds
- Half-open test requests: 1

#### External API Circuit Breaker
```typescript
import { externalApiCircuitBreaker } from '../utils/circuitBreaker';

await externalApiCircuitBreaker.execute(async () => {
  return await fetch(url);
});
```

Configuration:
- Failure threshold: 5 failures
- Reset timeout: 60 seconds
- Half-open test requests: 2

### Custom Circuit Breakers
```typescript
const myCircuitBreaker = new CircuitBreaker({
  name: 'MyService',
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenRequests: 2,
});
```

## 2. Retry Strategy with Exponential Backoff

### Purpose
Automatically retries failed operations with increasing delays, handling transient failures.

### Location
`src/backend/utils/retryStrategy.ts`

### Pre-configured Strategies

#### Database Retry
```typescript
import { dbRetry } from '../utils/retryStrategy';

const user = await dbRetry(() => 
  prisma.user.findUnique({ where: { id: userId } })
);
```

Configuration:
- Max retries: 3
- Initial delay: 100ms
- Max delay: 2000ms
- Backoff multiplier: 2

#### API Retry
```typescript
import { apiRetry } from '../utils/retryStrategy';

const response = await apiRetry(() =>
  fetch('https://api.example.com/data')
);
```

Configuration:
- Max retries: 3
- Initial delay: 500ms
- Max delay: 5000ms
- Backoff multiplier: 2

#### Cache Retry
```typescript
import { cacheRetry } from '../utils/retryStrategy';

const value = await cacheRetry(() =>
  redis.get(key)
);
```

Configuration:
- Max retries: 2
- Initial delay: 50ms
- Max delay: 500ms
- Backoff multiplier: 2

### Custom Retry Strategy
```typescript
import { withRetry } from '../utils/retryStrategy';

const result = await withRetry(
  () => myOperation(),
  {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: ['timeout', 'connection'],
  }
);
```

## 3. Query Result Caching

### Purpose
Reduces database load by caching frequently accessed query results.

### Location
`src/backend/services/queryCache.ts`

### Cache TTL Configuration

The service provides predefined TTL values for different data types:

- **User data**: 5-10 minutes (rarely changes)
- **Group data**: 2-3 minutes (changes moderately)
- **Event data**: 30-60 seconds (changes frequently)
- **Tournament data**: 1-2 minutes
- **Static data**: 30-60 minutes

### Usage Examples

#### Basic Query Caching
```typescript
import { cachedQuery, CACHE_TTL } from '../services/queryCache';

const user = await cachedQuery(
  'user:profile',
  { userId },
  CACHE_TTL.USER_PROFILE,
  async () => prisma.user.findUnique({ where: { id: userId } })
);
```

#### Using Pre-configured Helpers
```typescript
import { UserQueryCache } from '../services/queryCache';

// Cache user profile
const profile = await UserQueryCache.getProfile(
  userId,
  async () => prisma.user.findUnique({ where: { id: userId } })
);

// Cache user groups
const groups = await UserQueryCache.getGroups(
  userId,
  async () => prisma.groupMember.findMany({ where: { userId } })
);
```

#### Cache Invalidation
```typescript
import { UserQueryCache, invalidateQueryCache } from '../services/queryCache';

// Invalidate specific user cache
await UserQueryCache.invalidate(userId);

// Invalidate specific query
await invalidateQueryCache('user:profile', { userId });

// Invalidate all queries with prefix
await invalidateQueryCache('event:list');
```

### Available Cache Helpers

- `UserQueryCache` - User profiles, groups, and events
- `GroupQueryCache` - Group details and members
- `EventQueryCache` - Event details, participants, and lists
- `TournamentQueryCache` - Tournament details and standings

## 4. ETag Support for HTTP Caching

### Purpose
Reduces bandwidth usage and improves response times using HTTP conditional requests.

### Location
`src/backend/middleware/etag.ts`

### Usage Examples

#### Apply ETag Middleware to Route
```typescript
import { etagMiddleware } from '../middleware/etag';

router.get('/api/events', etagMiddleware(), async (req, res) => {
  const events = await prisma.event.findMany();
  res.json(events);
});
```

#### With Cache-Control Headers
```typescript
import { etagMiddleware, publicCache } from '../middleware/etag';

router.get('/api/events', 
  etagMiddleware(),
  publicCache(300), // Cache for 5 minutes
  async (req, res) => {
    const events = await prisma.event.findMany();
    res.json(events);
  }
);
```

#### Last-Modified Header
```typescript
import { lastModifiedMiddleware } from '../middleware/etag';

router.get('/api/event/:id', lastModifiedMiddleware(), async (req, res) => {
  const event = await prisma.event.findUnique({ 
    where: { id: req.params.id } 
  });
  
  // Set last modified time
  (res as any).setLastModified(event.updatedAt);
  res.json(event);
});
```

#### Disable Caching
```typescript
import { noCache } from '../middleware/etag';

router.post('/api/auth/login', noCache(), async (req, res) => {
  // Authentication endpoint should not be cached
});
```

## 5. Response Streaming

### Purpose
Handles large datasets efficiently by streaming results instead of loading everything into memory.

### Location
`src/backend/utils/streamResponse.ts`

### Usage Examples

#### Stream JSON Array
```typescript
import { streamJsonArray } from '../utils/streamResponse';

router.get('/api/events/all', async (req, res) => {
  await streamJsonArray(res, async function* () {
    const events = await prisma.event.findMany();
    for (const event of events) {
      yield event;
    }
  });
});
```

#### Stream with Batching
```typescript
import { streamJsonArray, createBatchStream } from '../utils/streamResponse';

router.get('/api/events/all', async (req, res) => {
  const batchStream = createBatchStream(
    async (offset, limit) => {
      return prisma.event.findMany({
        skip: offset,
        take: limit,
      });
    },
    50 // batch size
  );
  
  await streamJsonArray(res, batchStream);
});
```

#### Stream CSV Export
```typescript
import { streamCsv } from '../utils/streamResponse';

router.get('/api/events/export', async (req, res) => {
  await streamCsv(
    res,
    ['ID', 'Title', 'Date', 'Location'],
    async function* () {
      const events = await prisma.event.findMany();
      for (const event of events) {
        yield [event.id, event.title, event.startTime, event.location];
      }
    }
  );
});
```

#### Stream NDJSON
```typescript
import { streamNdjson } from '../utils/streamResponse';

router.get('/api/events/feed', async (req, res) => {
  await streamNdjson(res, async function* () {
    for await (const event of eventStream) {
      yield event;
    }
  });
});
```

## 6. Enhanced Business Metrics

### Purpose
Provides detailed metrics for monitoring business operations and performance.

### Location
`src/backend/services/metricsService.ts`

### Available Metrics

#### Event Metrics
```typescript
import { recordEventCreated, recordEventParticipation } from '../services/metricsService';

// Record event creation with type
recordEventCreated('football');

// Record participation with status
recordEventParticipation('confirmed');
```

#### User Metrics
```typescript
import { recordUserRegistration } from '../services/metricsService';

// Record registration with method
recordUserRegistration('email');
recordUserRegistration('google');
```

#### Communication Metrics
```typescript
import { recordEmailSent, recordCommentCreated, recordInvitationSent } from '../services/metricsService';

// Track email delivery
recordEmailSent('success');
recordEmailSent('failed');

// Track engagement
recordCommentCreated();
recordInvitationSent('group');
```

#### Search Metrics
```typescript
import { recordSearchQuery } from '../services/metricsService';

recordSearchQuery('events');
recordSearchQuery('groups');
```

### Accessing Metrics

Metrics are exposed on the `/metrics` endpoint in Prometheus format:

```bash
curl http://localhost:3000/metrics
```

For production, protect this endpoint:

```bash
# Set token in .env
METRICS_TOKEN=your-secret-token

# Access with token
curl -H "Authorization: Bearer your-secret-token" http://localhost:3000/metrics
```

## 7. Database Health Monitoring

### Purpose
Provides visibility into database connection pool status and performance.

### Location
`src/backend/utils/databaseHealth.ts`

### Health Check Endpoint

The enhanced health check now includes:

- Database connection status
- Query response time
- Connection pool statistics (total, idle, active)
- Redis connection status (if enabled)
- Memory usage
- Overall system status

### Access Health Check

```bash
# Basic health check (public)
curl http://localhost:3000/health

# Detailed health check (requires token)
HEALTH_CHECK_TOKEN=your-secret-token
curl -H "Authorization: Bearer $HEALTH_CHECK_TOKEN" http://localhost:3000/health
```

### Response Example

```json
{
  "status": "healthy",
  "timestamp": "2024-01-13T12:00:00.000Z",
  "uptime": 3600,
  "database": {
    "connected": true,
    "responseTime": 5,
    "pool": {
      "total": 10,
      "idle": 5,
      "active": 5
    }
  },
  "redis": {
    "enabled": true,
    "connected": true,
    "latency": 2
  },
  "memory": {
    "used": 128,
    "total": 512,
    "percentage": 25
  }
}
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Circuit Breaker (uses default values if not set)
# No additional configuration needed

# Retry Strategy (uses default values if not set)
# No additional configuration needed

# Cache Configuration
CACHE_MAX_SIZE=10000

# Database Connection Pool
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=5000
DB_MAX_LIFETIME_SECONDS=1800
DB_QUERY_TIMEOUT_MS=30000
DB_STATEMENT_TIMEOUT_MS=30000

# Health Check
HEALTH_CHECK_DB_SLOW_MS=1000
HEALTH_CHECK_MEMORY_THRESHOLD=90
HEALTH_CHECK_TOKEN=your-secret-token-for-detailed-health

# Metrics
METRICS_TOKEN=your-secret-token-for-metrics
```

## Performance Impact

Expected improvements with these enhancements:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Cache hit rate | 0% | 70-85% | Database load reduction |
| Failed requests (transient) | 5-10% | 1-2% | Retry mechanism |
| Bandwidth usage | 100% | 30-50% | ETag caching |
| Memory usage (large lists) | High | Low | Streaming responses |
| Error recovery time | Minutes | Seconds | Circuit breaker |

## Best Practices

1. **Use query caching for frequently accessed data** that doesn't change often
2. **Apply ETags to GET endpoints** that return the same data repeatedly
3. **Use streaming for large datasets** (>100 items)
4. **Wrap external service calls** in circuit breakers
5. **Use retry logic for database operations** that may fail transiently
6. **Monitor metrics regularly** to identify bottlenecks
7. **Set appropriate cache TTLs** based on data volatility

## Monitoring and Debugging

### Check Circuit Breaker Status

```typescript
import { emailCircuitBreaker } from '../utils/circuitBreaker';

const stats = emailCircuitBreaker.getStats();
console.log('Circuit status:', stats.state);
console.log('Failures:', stats.failures);
console.log('Successes:', stats.successes);
```

### Check Cache Stats

View cache metrics in Prometheus:
- `cache_hits_total`
- `cache_misses_total`
- `cache_operation_duration_seconds`

### Monitor Database Pool

Check the health endpoint for connection pool statistics.

## Troubleshooting

### Circuit Breaker Stuck Open

If a circuit breaker is stuck open:

```typescript
emailCircuitBreaker.reset();
```

### Cache Not Working

1. Check if Redis is enabled and connected
2. Verify cache keys are unique
3. Check TTL values are appropriate
4. Monitor cache hit/miss ratios

### Streaming Issues

1. Ensure client supports chunked encoding
2. Check for network timeouts
3. Verify batch sizes are appropriate

## Migration Guide

These features are opt-in and backwards compatible. To adopt:

1. **Start with monitoring**: Enable metrics and health checks
2. **Add retry logic**: Apply to database operations prone to transient failures
3. **Enable caching**: Start with read-heavy endpoints
4. **Add ETags**: Apply to frequently accessed, rarely changing endpoints
5. **Implement streaming**: Use for large dataset exports
6. **Add circuit breakers**: Wrap external service calls

## Conclusion

These improvements significantly enhance the backend's scalability and reliability while maintaining simplicity and backwards compatibility. They provide a solid foundation for handling increased load and recovering gracefully from failures.
