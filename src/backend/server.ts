import 'dotenv/config';
import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import session from 'express-session';
import passport from './config/passport';

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
import { apiLimiter } from './middleware/rateLimiter';
import { requestTimeout } from './middleware/requestTimeout';
import { logger } from './utils/logger';
import { validateEnvironmentOrThrow } from './utils/envValidator';
import { config, logConfig } from './config/appConfig';
import { requestContext, performanceMonitor } from './middleware/requestContext';
import { sanitizeInput } from './middleware/sanitizeInput';
import { errorHandler } from './middleware/errorHandler';
import { setupGracefulShutdown, performHealthCheck } from './utils/databaseHealth';
import { startEmailQueueProcessor, stopEmailQueueProcessor } from './services/emailQueueService';
import { startScheduledJobs, stopScheduledJobs } from './services/scheduledJobs';
import { ensureUploadDirectories } from './utils/imageProcessor';
import { closeDatabaseConnections } from './config/database';

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

const app: Application = express();
const PORT = config.port;

// Add request context and performance monitoring
app.use(requestContext);
app.use(performanceMonitor(config.slowRequestThresholdMs));

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

// Session middleware for OAuth (required by passport)
app.use(session({
  secret: process.env.JWT_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 // 1 hour
  }
}));

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

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

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

// Enhanced health check with detailed metrics
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const healthCheck = await performHealthCheck();
    
    const statusCode = healthCheck.status === 'healthy' ? 200 
                     : healthCheck.status === 'degraded' ? 200 
                     : 503;
    
    res.status(statusCode).json({
      status: healthCheck.status,
      message: healthCheck.status === 'healthy' 
        ? 'Teamly API is running smoothly' 
        : healthCheck.status === 'degraded'
        ? 'Teamly API is running with degraded performance'
        : 'Teamly API is experiencing issues',
      ...healthCheck,
    });
  } catch (error) {
    logger.error('Health check failed', 'Server', { error });
    res.status(503).json({
      status: 'unhealthy',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
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
  .then(() => {
    logger.info('Upload directories initialized', 'Server');
    
    // Start server after upload directories are ready
    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`, 'Server');
      logger.info(`API available at http://localhost:${PORT}`, 'Server');
      
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
