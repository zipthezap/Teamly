import 'dotenv/config';
import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import session from 'express-session';
import RedisStore from 'connect-redis';
import passport from './config/passport';
import crypto from 'crypto';

import authRoutes from './routes/authRoutes';
import groupRoutes from './routes/groupRoutes';
import eventRoutes from './routes/eventRoutes';
import twoFactorRoutes from './routes/twoFactorRoutes';
import eventRequestRoutes from './routes/eventRequestRoutes';
import emailRoutes from './routes/emailRoutes';
import commentRoutes from './routes/commentRoutes';
import groupChatRoutes from './routes/groupChatRoutes';
import notificationPreferenceRoutes from './routes/notificationPreferenceRoutes';
import notificationRoutes from './routes/notificationRoutes';
import teamUpRoutes from './routes/teamUpRoutes';
import reminderRoutes from './routes/reminderRoutes';
import tournamentRoutes from './routes/tournamentRoutes';
import { distributedApiLimiter } from './middleware/distributedRateLimiter';
import { requestTimeout } from './middleware/requestTimeout';
import { logger } from './utils/logger';
import { validateEnvironmentOrThrow } from './utils/envValidator';
import { config, logConfig } from './config/appConfig';
import { requestContext, performanceMonitor } from './middleware/requestContext';
import { queryMonitorMiddleware, initializeQueryMonitoring } from './middleware/queryMonitor';
import { sanitizeInput } from './middleware/sanitizeInput';
import { errorHandler } from './middleware/errorHandler';
import { setupGracefulShutdown, performHealthCheck } from './utils/databaseHealth';
import { startEmailQueueProcessor, stopEmailQueueProcessor } from './services/emailQueueService';
import { startScheduledJobs, stopScheduledJobs } from './services/scheduledJobs';
import { initializeJobQueue, shutdownJobQueue } from './services/jobQueueService';
import { ensureUploadDirectories } from './utils/imageProcessor';
import { closeDatabaseConnections, initializePoolMonitoring } from './config/database';
import { initializeRedis, closeRedis, getRedisClient, isRedisEnabled } from './config/redis';
import { cleanupCache } from './services/cacheService';
import { metricsMiddleware, getMetrics } from './services/metricsService';

// Validate environment variables before starting the server
try {
  validateEnvironmentOrThrow();
  logger.info('Environment validation successful', 'Server');
  
  // Log application configuration
  logConfig();
} catch (error) {
  logger.error('Environment validation failed', 'Server', { error });
  process.exit(1);
}

// Setup graceful shutdown handlers
setupGracefulShutdown();

/**
 * Timing-safe string comparison to prevent timing attacks
 * Uses crypto.timingSafeEqual with constant-time operations
 * Fixed maximum length to prevent timing leaks through dynamic padding
 */
const timingSafeCompare = (a: string, b: string): boolean => {
  // Use a fixed maximum length for consistent timing
  const FIXED_MAX_LENGTH = 256;
  
  // Handle null/undefined cases with a realistic dummy comparison
  if (!a || !b) {
    // Create two different buffers for a realistic comparison
    const dummyBufA = Buffer.alloc(FIXED_MAX_LENGTH);
    const dummyBufB = Buffer.alloc(FIXED_MAX_LENGTH);
    dummyBufB[0] = 1; // Make them different
    try {
      crypto.timingSafeEqual(dummyBufA, dummyBufB);
    } catch {
      // Expected to throw since buffers are different
    }
    return false;
  }
  
  // Pad both strings to fixed length for consistent timing
  const bufA = Buffer.from(a.padEnd(FIXED_MAX_LENGTH, '\0').slice(0, FIXED_MAX_LENGTH));
  const bufB = Buffer.from(b.padEnd(FIXED_MAX_LENGTH, '\0').slice(0, FIXED_MAX_LENGTH));
  
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};

/**
 * Extract bearer token from Authorization header
 * Case-insensitive to handle 'Bearer', 'bearer', 'BEARER'
 */
const extractBearerToken = (authHeader?: string): string => {
  if (!authHeader) {
    return '';
  }
  return authHeader.replace(/^Bearer\s+/i, '') || '';
};

const app: Application = express();
const PORT = config.port;

// Initialize query monitoring
initializeQueryMonitoring();

// Add request context and performance monitoring
app.use(requestContext);
app.use(performanceMonitor(config.slowRequestThresholdMs));
app.use(queryMonitorMiddleware());

// Add Prometheus metrics tracking
app.use(metricsMiddleware);

// Enable gzip compression for responses
app.use(compression({
  // Only compress responses larger than 1kb
  threshold: 1024,
  // Compression level (0-9, where 6 is default balance of speed/compression)
  level: 6,
  // Filter function to determine what to compress
  filter: (req, res) => {
    // Don't compress if explicitly requested not to
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression's default filter
    return compression.filter(req, res);
  }
}));

// Security: Add helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      formAction: ["'self'"], // Allow form submissions to same origin
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests for uploads
}));

// Middleware - CORS configuration
const corsOptions = {
  origin: config.corsOrigin,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Security: Limit request body size to prevent DoS attacks
app.use(express.json({ limit: config.requestBodySizeLimit }));
app.use(express.urlencoded({ extended: true, limit: config.requestBodySizeLimit }));

// Session configuration constants
const SESSION_TTL_SECONDS = 60 * 60; // 1 hour
const SESSION_COOKIE_MAX_AGE = SESSION_TTL_SECONDS * 1000; // Convert to milliseconds

// Get session secret with production validation
const getSessionSecret = (): string => {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  
  // In production, require a separate session secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production for security');
  }
  
  // In development, allow fallback but log warning
  if (process.env.NODE_ENV === 'development') {
    logger.warn('Using JWT_SECRET for session secret. Set SESSION_SECRET in production.', 'Server');
  }
  
  return process.env.JWT_SECRET || 'your-session-secret';
};

// Session middleware for OAuth (required by passport)
// Use Redis for session storage if available, otherwise fall back to in-memory
const sessionConfig: session.SessionOptions = {
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: SESSION_COOKIE_MAX_AGE,
    sameSite: 'strict' // CSRF protection
  }
};

// Add Redis store if enabled
if (isRedisEnabled()) {
  const redisClient = getRedisClient();
  if (redisClient) {
    sessionConfig.store = new RedisStore({
      client: redisClient,
      prefix: 'sess:',
      ttl: SESSION_TTL_SECONDS
    });
    logger.info('Using Redis for session storage', 'Server');
  } else {
    logger.warn('Redis enabled but client not available, using in-memory session storage', 'Server');
  }
} else {
  logger.info('Using in-memory session storage (not recommended for production)', 'Server');
}

app.use(session(sessionConfig));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Sanitize all incoming data to prevent XSS
app.use(sanitizeInput);

// Add request timeout (30 seconds by default)
app.use(requestTimeout(30000));

// Serve static files from uploads directory with security headers
app.use('/uploads', express.static(path.join(__dirname, '../../uploads'), {
  maxAge: '1d', // Cache for 1 day
  setHeaders: (res, filePath) => {
    // Only serve image files
    const ext = path.extname(filePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      // Set proper Content-Type for each format
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
      };
      res.setHeader('Content-Type', mimeTypes[ext]);
      // Prevent execution of any scripts
      res.setHeader('X-Content-Type-Options', 'nosniff');
    } else {
      // Deny access to non-image files
      res.status(403).end();
    }
  }
}));

// Apply distributed rate limiting to all API routes (falls back to in-memory if Redis unavailable)
app.use('/api/', distributedApiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/event-requests', eventRequestRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/chat', groupChatRoutes);
app.use('/api/notification-preferences', notificationPreferenceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/teamup', teamUpRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/tournaments', tournamentRoutes);

// Metrics endpoint for Prometheus
// In production, restrict access via network rules or add IP whitelist
// For now, we'll add a simple token-based authentication
app.get('/metrics', (req: Request, res: Response, next) => {
  // Allow access if METRICS_TOKEN is not set (for backward compatibility)
  // Or if the provided token matches (using timing-safe comparison)
  const metricsToken = process.env.METRICS_TOKEN;
  if (metricsToken) {
    const providedToken = extractBearerToken(req.headers.authorization);
    // Always call timingSafeCompare to prevent timing attacks
    if (!timingSafeCompare(providedToken, metricsToken)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
  next();
}, getMetrics);

// Enhanced health check with detailed metrics
app.get('/health', async (req: Request, res: Response) => {
  try {
    const healthCheck = await performHealthCheck();
    
    const statusCode = healthCheck.status === 'healthy' ? 200 
                     : healthCheck.status === 'degraded' ? 200 
                     : 503;
    
    // Check if detailed health info is requested with auth token (using timing-safe comparison)
    const healthToken = process.env.HEALTH_CHECK_TOKEN;
    const providedToken = extractBearerToken(req.headers.authorization);
    
    // Always call timingSafeCompare to maintain constant-time behavior
    // When no token is configured, use a sentinel value that never matches real tokens
    // but still goes through the same comparison logic
    const tokenToCheck = healthToken || '__HEALTH_CHECK_DISABLED__';
    const tokenMatches = timingSafeCompare(providedToken, tokenToCheck);
    // If no token is configured, grant access (backward compatibility)
    const isAuthenticated = !healthToken || tokenMatches;
    
    // Return detailed info only if authenticated, otherwise return basic status
    if (isAuthenticated) {
      res.status(statusCode).json({
        status: healthCheck.status,
        message: healthCheck.status === 'healthy' 
          ? 'Teamly API is running smoothly' 
          : healthCheck.status === 'degraded'
          ? 'Teamly API is running with degraded performance'
          : 'Teamly API is experiencing issues',
        ...healthCheck,
      });
    } else {
      // Return minimal info for unauthenticated requests
      res.status(statusCode).json({
        status: healthCheck.status,
      });
    }
  } catch (error) {
    logger.error('Health check failed', 'Server', { error });
    // Minimal error response - no details or timestamp for security
    res.status(503).json({
      status: 'unhealthy',
    });
  }
});

// Use centralized error handling middleware
app.use(errorHandler);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start background services
let emailQueueInterval: NodeJS.Timeout | null = null;

// Initialize upload directories before starting server
ensureUploadDirectories()
  .then(async () => {
    logger.info('Upload directories initialized', 'Server');
    
    // Initialize Redis connection (optional)
    await initializeRedis();
    
    // Start server after upload directories are ready
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server is running on port ${PORT}`, 'Server');
      logger.info(`API available at http://localhost:${PORT}`, 'Server');
      logger.info(`Server accessible on all network interfaces (0.0.0.0:${PORT})`, 'Server');
      
      // Initialize database connection pool monitoring
      initializePoolMonitoring();
      
      // Initialize background job queue
      initializeJobQueue();
      
      // Start email queue processor
      emailQueueInterval = startEmailQueueProcessor();
      
      // Start scheduled cleanup jobs
      startScheduledJobs();
      
      logger.info('Background services started', 'Server');
    });

    // Enhanced graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Shutting down gracefully...', 'Server');
      
      // Stop accepting new connections
      server.close(async () => {
        logger.info('Server closed', 'Server');
        
        // Stop background services
        if (emailQueueInterval) {
          stopEmailQueueProcessor(emailQueueInterval);
        }
        stopScheduledJobs();
        
        // Shutdown job queue
        try {
          shutdownJobQueue();
        } catch (error) {
          logger.error('Error shutting down job queue', 'Server', { error });
        }
        
        // Close Redis connection
        try {
          await closeRedis();
        } catch (error) {
          logger.error('Error closing Redis connection', 'Server', { error });
        }
        
        // Cleanup cache
        try {
          cleanupCache();
        } catch (error) {
          logger.error('Error cleaning up cache', 'Server', { error });
        }
        
        // Close database connections
        try {
          await closeDatabaseConnections();
        } catch (error) {
          logger.error('Error during database shutdown', 'Server', { error });
        }
        
        process.exit(0);
      });
      
      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forcing shutdown after timeout', 'Server');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  })
  .catch((error) => {
    logger.error('Failed to initialize upload directories', 'Server', { error });
    process.exit(1);
  });

export default app;
