import * as client from 'prom-client';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';
import { logger } from '../utils/logger';
import { Request, Response, NextFunction } from 'express';

/**
 * Prometheus metrics registry
 */
export const register = new Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

/**
 * HTTP request metrics
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

/**
 * Database metrics
 */
export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const databaseConnectionsActive = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

export const databaseConnectionsIdle = new Gauge({
  name: 'database_connections_idle',
  help: 'Number of idle database connections',
  registers: [register],
});

/**
 * Cache metrics
 */
export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheOperationDuration = new Histogram({
  name: 'cache_operation_duration_seconds',
  help: 'Duration of cache operations in seconds',
  labelNames: ['operation', 'cache_type'],
  buckets: [0.0001, 0.001, 0.01, 0.05, 0.1],
  registers: [register],
});

/**
 * Authentication metrics
 */
export const authAttempts = new Counter({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'status'],
  registers: [register],
});

export const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Number of currently active users',
  registers: [register],
});

/**
 * Rate limiting metrics
 */
export const rateLimitExceeded = new Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded events',
  labelNames: ['endpoint'],
  registers: [register],
});

/**
 * Business metrics
 */
export const eventsCreated = new Counter({
  name: 'events_created_total',
  help: 'Total number of events created',
  labelNames: ['event_type'], // Track by sport type
  registers: [register],
});

export const groupsCreated = new Counter({
  name: 'groups_created_total',
  help: 'Total number of groups created',
  labelNames: ['is_public'], // Track public vs private
  registers: [register],
});

export const tournamentsCreated = new Counter({
  name: 'tournaments_created_total',
  help: 'Total number of tournaments created',
  labelNames: ['format'], // Track by tournament format
  registers: [register],
});

export const userRegistrations = new Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['method'], // email, google, facebook
  registers: [register],
});

export const eventParticipations = new Counter({
  name: 'event_participations_total',
  help: 'Total number of event participations',
  labelNames: ['status'], // confirmed, declined, pending
  registers: [register],
});

export const commentsCreated = new Counter({
  name: 'comments_created_total',
  help: 'Total number of comments created',
  registers: [register],
});

export const invitationsSent = new Counter({
  name: 'invitations_sent_total',
  help: 'Total number of invitations sent',
  labelNames: ['type'], // group, event
  registers: [register],
});

export const emailsSent = new Counter({
  name: 'emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['status'], // success, failed
  registers: [register],
});

export const searchQueries = new Counter({
  name: 'search_queries_total',
  help: 'Total number of search queries',
  labelNames: ['type'], // events, groups, users
  registers: [register],
});

/**
 * Middleware to track HTTP metrics
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Track request
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();
    
    // Record metrics
    httpRequestDuration.labels(method, route, statusCode).observe(duration);
    httpRequestTotal.labels(method, route, statusCode).inc();
    
    // Track errors (4xx and 5xx)
    if (res.statusCode >= 400) {
      httpRequestErrors.labels(method, route, statusCode).inc();
    }
  });
  
  next();
};

/**
 * Record database query metric
 */
export const recordDatabaseQuery = (operation: string, model: string, duration: number): void => {
  databaseQueryDuration.labels(operation, model).observe(duration / 1000);
};

/**
 * Record cache operation
 */
export const recordCacheHit = (cacheType: string = 'default'): void => {
  cacheHits.labels(cacheType).inc();
};

export const recordCacheMiss = (cacheType: string = 'default'): void => {
  cacheMisses.labels(cacheType).inc();
};

export const recordCacheOperation = (
  operation: string,
  cacheType: string,
  duration: number
): void => {
  cacheOperationDuration.labels(operation, cacheType).observe(duration / 1000);
};

/**
 * Record authentication attempt
 */
export const recordAuthAttempt = (method: string, status: 'success' | 'failed'): void => {
  authAttempts.labels(method, status).inc();
};

/**
 * Update active users count
 */
export const updateActiveUsers = (count: number): void => {
  activeUsers.set(count);
};

/**
 * Record rate limit exceeded
 */
export const recordRateLimitExceeded = (endpoint: string): void => {
  rateLimitExceeded.labels(endpoint).inc();
};

/**
 * Record business metrics
 */
export const recordEventCreated = (eventType?: string): void => {
  eventsCreated.labels(eventType || 'unknown').inc();
};

export const recordGroupCreated = (isPublic: boolean = false): void => {
  groupsCreated.labels(isPublic ? 'true' : 'false').inc();
};

export const recordTournamentCreated = (format?: string): void => {
  tournamentsCreated.labels(format || 'unknown').inc();
};

export const recordUserRegistration = (method: string = 'email'): void => {
  userRegistrations.labels(method).inc();
};

export const recordEventParticipation = (status: string): void => {
  eventParticipations.labels(status).inc();
};

export const recordCommentCreated = (): void => {
  commentsCreated.inc();
};

export const recordInvitationSent = (type: 'group' | 'event'): void => {
  invitationsSent.labels(type).inc();
};

export const recordEmailSent = (status: 'success' | 'failed'): void => {
  emailsSent.labels(status).inc();
};

export const recordSearchQuery = (type: 'events' | 'groups' | 'users'): void => {
  searchQueries.labels(type).inc();
};

/**
 * Get metrics endpoint handler
 */
export const getMetrics = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics', 'Metrics', { error });
    res.status(500).send('Error generating metrics');
  }
};

/**
 * Reset all metrics (useful for testing)
 */
export const resetMetrics = (): void => {
  register.resetMetrics();
};

logger.info('Prometheus metrics initialized', 'Metrics');
