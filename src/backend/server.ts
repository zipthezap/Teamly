import 'dotenv/config';
import express, { Request, Response, NextFunction, Application } from 'express';
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

// Validate environment variables before starting the server
try {
  validateEnvironmentOrThrow();
  logger.info('Environment validation successful', 'Server');
} catch (error) {
  logger.error('Environment validation failed', 'Server', { error });
  process.exit(1);
}

const app: Application = express();
const PORT = process.env.PORT || 3000;

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
// In production, specify exact origins instead of allowing all
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'http://localhost:3001'
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Security: Limit request body size to prevent DoS attacks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Teamly API is running' });
});

// Error handling middleware
app.use((err: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', 'ErrorMiddleware', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`, 'Server');
  logger.info(`API available at http://localhost:${PORT}`, 'Server');
});

export default app;
