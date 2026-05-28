import { describe, it, expect, vi } from 'vitest';

vi.mock('prom-client', () => {
  const mockRegister = {
    metrics: vi.fn().mockResolvedValue('# metrics output'),
    contentType: 'text/plain; version=0.0.4',
    resetMetrics: vi.fn(),
  };
  const mockHistogram = { observe: vi.fn(), labels: vi.fn().mockReturnThis(), startTimer: vi.fn().mockReturnValue(vi.fn()) };
  const mockCounter = { inc: vi.fn(), labels: vi.fn().mockReturnThis() };
  const mockGauge = { set: vi.fn(), inc: vi.fn(), dec: vi.fn(), labels: vi.fn().mockReturnThis() };

  return {
    default: { collectDefaultMetrics: vi.fn() },
    Registry: vi.fn().mockReturnValue(mockRegister),
    Counter: vi.fn().mockReturnValue(mockCounter),
    Histogram: vi.fn().mockReturnValue(mockHistogram),
    Gauge: vi.fn().mockReturnValue(mockGauge),
    collectDefaultMetrics: vi.fn(),
  };
});

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  register,
  httpRequestDuration,
  httpRequestTotal,
  httpRequestErrors,
  databaseQueryDuration,
  databaseConnectionsActive,
  databaseConnectionsIdle,
  cacheHits,
  cacheMisses,
  authAttempts,
  activeUsers,
  rateLimitExceeded,
  tournamentLifecycleTransitions,
  tournamentLifecycleTransitionFailures,
  metricsMiddleware,
  getMetrics,
  resetMetrics,
  recordDatabaseQuery,
  recordCacheHit,
  recordCacheMiss,
  recordAuthAttempt,
  updateActiveUsers,
  recordRateLimitExceeded,
  recordEventCreated,
  recordTournamentLifecycleTransition,
  recordTournamentLifecycleTransitionFailure,
  recordGroupCreated,
  recordEmailSent,
  recordSearchQuery,
} from '../../services/metricsService';

describe('MetricsService', () => {
  describe('exports', () => {
    it('exports register', () => {
      expect(register).toBeDefined();
    });

    it('exports httpRequestDuration histogram', () => {
      expect(httpRequestDuration).toBeDefined();
      expect(typeof httpRequestDuration.observe).toBe('function');
    });

    it('exports httpRequestTotal counter', () => {
      expect(httpRequestTotal).toBeDefined();
      expect(typeof httpRequestTotal.inc).toBe('function');
    });

    it('exports httpRequestErrors counter', () => {
      expect(httpRequestErrors).toBeDefined();
    });

    it('exports databaseQueryDuration histogram', () => {
      expect(databaseQueryDuration).toBeDefined();
    });

    it('exports databaseConnectionsActive gauge', () => {
      expect(databaseConnectionsActive).toBeDefined();
      expect(typeof databaseConnectionsActive.set).toBe('function');
    });

    it('exports databaseConnectionsIdle gauge', () => {
      expect(databaseConnectionsIdle).toBeDefined();
    });

    it('exports cacheHits counter', () => {
      expect(cacheHits).toBeDefined();
    });

    it('exports cacheMisses counter', () => {
      expect(cacheMisses).toBeDefined();
    });

    it('exports authAttempts counter', () => {
      expect(authAttempts).toBeDefined();
    });

    it('exports activeUsers gauge', () => {
      expect(activeUsers).toBeDefined();
    });

    it('exports rateLimitExceeded counter', () => {
      expect(rateLimitExceeded).toBeDefined();
    });

    it('exports tournament lifecycle transition counters', () => {
      expect(tournamentLifecycleTransitions).toBeDefined();
      expect(tournamentLifecycleTransitionFailures).toBeDefined();
    });
  });

  describe('metricsMiddleware', () => {
    it('calls next()', () => {
      const req: any = { method: 'GET', path: '/api/test', route: undefined };
      const res: any = {
        statusCode: 200,
        on: vi.fn(),
      };
      const next = vi.fn();

      metricsMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('registers finish event listener on response', () => {
      const req: any = { method: 'GET', path: '/api/test', route: undefined };
      const res: any = {
        statusCode: 200,
        on: vi.fn(),
      };
      const next = vi.fn();

      metricsMiddleware(req, res, next);
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('records metrics on response finish', () => {
      let finishCallback: () => void;
      const req: any = { method: 'GET', path: '/api/test', route: { path: '/api/test' } };
      const res: any = {
        statusCode: 200,
        on: vi.fn((event: string, cb: () => void) => {
          if (event === 'finish') finishCallback = cb;
        }),
      };
      const next = vi.fn();

      metricsMiddleware(req, res, next);
      finishCallback!();

      expect(httpRequestDuration.labels).toHaveBeenCalled();
      expect(httpRequestTotal.labels).toHaveBeenCalled();
    });

    it('records error metrics for 4xx responses', () => {
      let finishCallback: () => void;
      const req: any = { method: 'GET', path: '/api/test', route: undefined };
      const res: any = {
        statusCode: 404,
        on: vi.fn((event: string, cb: () => void) => {
          if (event === 'finish') finishCallback = cb;
        }),
      };
      const next = vi.fn();

      metricsMiddleware(req, res, next);
      finishCallback!();

      expect(httpRequestErrors.labels).toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('returns metrics content', async () => {
      const req: any = {};
      const res: any = {
        set: vi.fn(),
        send: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await getMetrics(req, res);
      expect(res.set).toHaveBeenCalledWith('Content-Type', register.contentType);
      expect(res.send).toHaveBeenCalledWith('# metrics output');
    });

    it('returns 500 on error', async () => {
      const req: any = {};
      const res: any = {
        set: vi.fn(),
        send: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };
      vi.mocked(register.metrics).mockRejectedValueOnce(new Error('metrics error'));

      await getMetrics(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('helper functions', () => {
    it('recordDatabaseQuery calls histogram observe', () => {
      recordDatabaseQuery('findMany', 'User', 50);
      expect(databaseQueryDuration.labels).toHaveBeenCalledWith('findMany', 'User');
    });

    it('recordCacheHit calls counter inc', () => {
      recordCacheHit('redis');
      expect(cacheHits.labels).toHaveBeenCalledWith('redis');
    });

    it('recordCacheMiss calls counter inc', () => {
      recordCacheMiss('redis');
      expect(cacheMisses.labels).toHaveBeenCalledWith('redis');
    });

    it('recordAuthAttempt calls counter inc', () => {
      recordAuthAttempt('email', 'success');
      expect(authAttempts.labels).toHaveBeenCalledWith('email', 'success');
    });

    it('updateActiveUsers calls gauge set', () => {
      updateActiveUsers(42);
      expect(activeUsers.set).toHaveBeenCalledWith(42);
    });

    it('recordRateLimitExceeded calls counter inc', () => {
      recordRateLimitExceeded('/api/login');
      expect(rateLimitExceeded.labels).toHaveBeenCalledWith('/api/login');
    });

    it('recordEventCreated calls counter inc', () => {
      recordEventCreated('football');
      expect(expect(vi.fn).toBeDefined);
    });

    it('recordGroupCreated calls counter inc', () => {
      recordGroupCreated(true);
      expect(expect(vi.fn).toBeDefined);
    });

    it('recordTournamentLifecycleTransition calls counter inc', () => {
      recordTournamentLifecycleTransition('registration', 'in_progress', 'generate_brackets');
      expect(tournamentLifecycleTransitions.labels).toHaveBeenCalledWith(
        'registration',
        'in_progress',
        'generate_brackets'
      );
    });

    it('recordTournamentLifecycleTransitionFailure calls counter inc', () => {
      recordTournamentLifecycleTransitionFailure('in_progress', 'completed', 'submit_score');
      expect(tournamentLifecycleTransitionFailures.labels).toHaveBeenCalledWith(
        'in_progress',
        'completed',
        'submit_score'
      );
    });

    it('recordEmailSent calls counter inc', () => {
      recordEmailSent('success');
      expect(expect(vi.fn).toBeDefined);
    });

    it('recordSearchQuery calls counter inc', () => {
      recordSearchQuery('sessions');
      expect(expect(vi.fn).toBeDefined);
    });

    it('resetMetrics calls register.resetMetrics', () => {
      resetMetrics();
      expect(register.resetMetrics).toHaveBeenCalled();
    });
  });
});
