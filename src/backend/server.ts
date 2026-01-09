import 'dotenv/config';
import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

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
import { apiLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { validateEnvironmentOrThrow } from './utils/envValidator';
import { config, logConfig } from './config/appConfig';
import { requestContext, performanceMonitor } from './middleware/requestContext';
import { sanitizeInput } from './middleware/sanitizeInput';
import { errorHandler } from './middleware/errorHandler';
import { checkDatabaseHealth, setupGracefulShutdown } from './utils/databaseHealth';
import { startEmailQueueProcessor, stopEmailQueueProcessor } from './services/emailQueueService';
import { startScheduledJobs, stopScheduledJobs } from './services/scheduledJobs';
import { ensureUploadDirectories } from './utils/imageProcessor';

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

// Security: Add helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
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

// Sanitize all incoming data to prevent XSS
app.use(sanitizeInput);

// Serve static files from uploads directory with security headers
app.use('/uploads', express.static(path.join(__dirname, '../../uploads'), {
  maxAge: '1d', // Cache for 1 day
  setHeaders: (res, filePath) => {
    // Only serve image files
    const ext = path.extname(filePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      res.setHeader('Content-Type', `image/${ext.substring(1)}`);
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

// Health check with database connectivity check
app.get('/health', async (_req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseHealth();
  
  if (dbHealthy) {
    res.json({ 
      status: 'ok', 
      message: 'Teamly API is running',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({ 
      status: 'error', 
      message: 'Database connection failed',
      database: 'disconnected',
      timestamp: new Date().toISOString()
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
  })
  .catch((error) => {
    logger.error('Failed to initialize upload directories', 'Server', { error });
    process.exit(1);
  });

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
const gracefulShutdown = () => {
  logger.info('Shutting down gracefully...', 'Server');
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('Server closed', 'Server');
    
    // Stop background services
    if (emailQueueInterval) {
      stopEmailQueueProcessor(emailQueueInterval);
    }
    stopScheduledJobs();
    
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

export default app;
