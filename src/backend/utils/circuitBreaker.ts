/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by failing fast when a service is unavailable.
 * The circuit breaker has three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests fail immediately
 * - HALF_OPEN: Testing if service has recovered
 */

import { logger } from './logger';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening circuit
  resetTimeout: number; // Time in ms before attempting to close circuit
  halfOpenRequests: number; // Number of test requests in half-open state
  name: string; // Name for logging
}

interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttempt: number = Date.now();
  private halfOpenAttempts: number = 0;

  constructor(private options: CircuitBreakerOptions) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN for ${this.options.name}`);
      }
      // Try to recover - move to half-open state
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenAttempts = 0;
      logger.info(`Circuit breaker entering HALF_OPEN state`, 'CircuitBreaker', {
        name: this.options.name,
      });
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.options.halfOpenRequests) {
        this.state = CircuitState.CLOSED;
        logger.info(`Circuit breaker CLOSED`, 'CircuitBreaker', {
          name: this.options.name,
        });
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in half-open state - reopen circuit
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      logger.warn(`Circuit breaker reopened after half-open failure`, 'CircuitBreaker', {
        name: this.options.name,
        nextAttempt: new Date(this.nextAttempt).toISOString(),
      });
    } else if (this.failureCount >= this.options.failureThreshold) {
      // Too many failures - open circuit
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      logger.error(`Circuit breaker OPENED`, 'CircuitBreaker', {
        name: this.options.name,
        failureCount: this.failureCount,
        nextAttempt: new Date(this.nextAttempt).toISOString(),
      });
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Reset the circuit breaker (for testing or manual intervention)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.nextAttempt = Date.now();
    logger.info(`Circuit breaker reset`, 'CircuitBreaker', {
      name: this.options.name,
    });
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN && Date.now() < this.nextAttempt;
  }
}

/**
 * Create a circuit breaker for email service
 */
export const emailCircuitBreaker = new CircuitBreaker({
  name: 'EmailService',
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenRequests: 2,
});

/**
 * Create a circuit breaker for Redis
 */
export const redisCircuitBreaker = new CircuitBreaker({
  name: 'Redis',
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  halfOpenRequests: 1,
});

/**
 * Create a circuit breaker for external API calls
 */
export const externalApiCircuitBreaker = new CircuitBreaker({
  name: 'ExternalAPI',
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenRequests: 2,
});
