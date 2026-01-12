# Quick Start: Scalability Features

This guide provides quick examples of how to use the new scalability features in Teamly.

## 1. Using the Cache Service

### Basic Caching

```typescript
import { CacheService } from './services/cacheService';

// Cache a value for 60 seconds
await CacheService.set('user:123', userData, 60);

// Retrieve cached value
const cached = await CacheService.get('user:123');
```

### Cache Wrapper Pattern

```typescript
// Wrap expensive operations with caching
const eventDetails = await CacheService.wrap(
  `event:${eventId}`,
  300, // 5 minutes TTL
  async () => {
    return await prisma.event.findUnique({
      where: { id: eventId },
      include: { participants: true, group: true }
    });
  }
);
```

### Cache Invalidation

```typescript
// Invalidate cache when data changes
await CacheService.invalidate('event', eventId);

// This will delete all keys matching: event:${eventId}*
```

## 2. Recording Metrics

### HTTP Metrics (Automatic)

The metrics middleware automatically tracks HTTP requests. No code changes needed!

### Business Metrics

```typescript
import { 
  recordEventCreated, 
  recordGroupCreated, 
  recordTournamentCreated 
} from './services/metricsService';

// Record when events are created
await prisma.event.create({ data: eventData });
recordEventCreated();

// Record group creation
await prisma.group.create({ data: groupData });
recordGroupCreated();
```

### Authentication Metrics

```typescript
import { recordAuthAttempt } from './services/metricsService';

// Track auth attempts
try {
  const user = await authenticateUser(email, password);
  recordAuthAttempt('password', 'success');
  return user;
} catch (error) {
  recordAuthAttempt('password', 'failed');
  throw error;
}
```

### Cache Metrics

```typescript
import { recordCacheHit, recordCacheMiss } from './services/metricsService';

const cached = await CacheService.get(key);
if (cached) {
  recordCacheHit('api');
  return cached;
}

recordCacheMiss('api');
const data = await fetchFromDatabase();
await CacheService.set(key, data, 300);
return data;
```

## 3. Distributed Rate Limiting

### Apply to Specific Routes

```typescript
import { distributedApiLimiter } from './middleware/distributedRateLimiter';
import { Router } from 'express';

const router = Router();

// Apply rate limiter to specific routes
router.get('/expensive-operation', distributedApiLimiter, async (req, res) => {
  // Your handler
});
```

### Role-Based Rate Limiting

```typescript
import { createRoleBasedRateLimiter } from './middleware/distributedRateLimiter';

const roleLimiter = createRoleBasedRateLimiter({
  admin: { windowMs: 15 * 60 * 1000, max: 1000 },
  moderator: { windowMs: 15 * 60 * 1000, max: 500 },
  member: { windowMs: 15 * 60 * 1000, max: 100 }
});

router.post('/create-tournament', roleLimiter, async (req, res) => {
  // Admins can make 1000 requests/15min
  // Moderators can make 500 requests/15min
  // Members can make 100 requests/15min
});
```

## 4. PM2 Production Deployment

### Basic Setup

```bash
# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# View status
pm2 list

# View logs
pm2 logs teamly-api

# Monitor in real-time
pm2 monit
```

### Zero-Downtime Updates

```bash
# Pull latest code
git pull

# Rebuild
npm install
npm run build

# Reload without downtime
pm2 reload teamly-api
```

### Scaling Instances

```bash
# Scale to 4 instances
pm2 scale teamly-api 4

# Scale to max CPU cores
pm2 scale teamly-api max
```

## 5. Redis Configuration

### Development Setup

```bash
# Start Redis with Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or use docker-compose
docker-compose up -d redis
```

### Environment Configuration

```bash
# .env
REDIS_URL=redis://localhost:6379
```

### Production Redis

```bash
# With authentication
REDIS_URL=redis://:password@redis.example.com:6379

# With username and password
REDIS_URL=redis://username:password@redis.example.com:6379

# Specific database
REDIS_URL=redis://localhost:6379/1
```

## 6. Monitoring with Prometheus

### View Metrics

```bash
# View raw metrics
curl http://localhost:3000/metrics

# View specific metric type
curl http://localhost:3000/metrics | grep http_requests_total
```

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'teamly-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
```

### Key Metrics to Monitor

- **Response Time**: `http_request_duration_seconds`
- **Error Rate**: `http_request_errors_total / http_requests_total`
- **Cache Hit Rate**: `cache_hits_total / (cache_hits_total + cache_misses_total)`
- **Active Users**: `active_users`
- **Database Performance**: `database_query_duration_seconds`

## 7. Health Checks

### Check Application Health

```bash
# Basic health check
curl http://localhost:3000/health

# Pretty print
curl http://localhost:3000/health | jq
```

### Response Format

```json
{
  "status": "healthy",
  "message": "Teamly API is running smoothly",
  "timestamp": "2026-01-12T17:00:00.000Z",
  "uptime": 3600,
  "database": {
    "connected": true,
    "responseTime": 15
  },
  "redis": {
    "enabled": true,
    "connected": true,
    "latency": 2
  },
  "memory": {
    "used": 150,
    "total": 512,
    "percentage": 29
  }
}
```

## 8. Common Patterns

### Caching Database Queries

```typescript
// Before: Direct database query
const events = await prisma.event.findMany({
  where: { groupId },
  include: { participants: true }
});

// After: With caching
const events = await CacheService.wrap(
  `group:${groupId}:events`,
  300, // 5 minutes
  async () => {
    return await prisma.event.findMany({
      where: { groupId },
      include: { participants: true }
    });
  }
);
```

### Invalidating Related Caches

```typescript
// When creating an event
const newEvent = await prisma.event.create({ data: eventData });
recordEventCreated();

// Invalidate group events cache
await CacheService.invalidate('group', groupId);
await CacheService.invalidate('event', newEvent.id);
```

### Rate Limiting Specific Operations

```typescript
import { createRateLimiterMiddleware } from './middleware/distributedRateLimiter';

// Create custom rate limiter for expensive operations
const expensiveOpLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  keyPrefix: 'rl:expensive',
});

router.post('/generate-report', expensiveOpLimiter, async (req, res) => {
  // Generate report
});
```

## 9. Performance Tips

### Do Cache
- User profiles
- Group memberships
- Event lists
- Permission checks
- Computed aggregations
- External API responses

### Don't Cache
- User-specific sensitive data (unless encrypted)
- Real-time data (e.g., live scores)
- Frequently changing data (e.g., current participants)
- Data that must be 100% consistent

### Cache TTL Guidelines
- Static content: 1 hour - 1 day
- User profiles: 5-15 minutes
- List views: 2-5 minutes
- Computed aggregations: 10-30 minutes
- Permission checks: 30-60 seconds

## 10. Troubleshooting

### Redis Connection Issues

```bash
# Test Redis connectivity
redis-cli -u $REDIS_URL ping

# Check application logs
pm2 logs teamly-api | grep Redis
```

### High Memory Usage

```bash
# Check memory usage
pm2 monit

# Clear cache if needed
redis-cli FLUSHDB

# Restart application
pm2 restart teamly-api
```

### Performance Issues

```bash
# Check metrics
curl http://localhost:3000/metrics | grep -E "(http_request_duration|cache_hits)"

# Check health
curl http://localhost:3000/health

# View PM2 monitoring
pm2 monit
```

## Additional Resources

- [Full Scalability Guide](./SCALABILITY_IMPROVEMENTS.md)
- [Redis Documentation](https://redis.io/documentation)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
