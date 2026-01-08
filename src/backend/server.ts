import 'dotenv/config';
import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';

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

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`, 'Server');
  logger.info(`API available at http://localhost:${PORT}`, 'Server');
});

export default app;
