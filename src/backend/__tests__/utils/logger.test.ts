import { vi } from 'vitest';
vi.unmock('../../utils/logger');

import { logger, LogLevel } from '../../utils/logger';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Logger', () => {
  let consoleSpy: {
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    // Spy on console methods
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore console methods
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.info.mockRestore();
    consoleSpy.debug.mockRestore();
  });

  describe('error', () => {
    it('should log error message to console.error', () => {
      logger.error('Test error message');
      
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.error.mock.calls[0][0];
      expect(logOutput).toContain('[ERROR]');
      expect(logOutput).toContain('Test error message');
    });

    it('should log error with context', () => {
      logger.error('Test error', 'TestContext');
      
      const logOutput = consoleSpy.error.mock.calls[0][0];
      expect(logOutput).toContain('[ERROR]');
      expect(logOutput).toContain('[TestContext]');
      expect(logOutput).toContain('Test error');
    });

    it('should log error with data', () => {
      const testData = { userId: '123', action: 'test' };
      logger.error('Test error', 'TestContext', testData);
      
      const logOutput = consoleSpy.error.mock.calls[0][0];
      expect(logOutput).toContain('[ERROR]');
      expect(logOutput).toContain('Test error');
      expect(logOutput).toContain('userId');
      expect(logOutput).toContain('123');
    });

    it('should include timestamp in log', () => {
      logger.error('Test error');
      
      const logOutput = consoleSpy.error.mock.calls[0][0];
      expect(logOutput).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('warn', () => {
    it('should log warning message to console.warn', () => {
      logger.warn('Test warning message');
      
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.warn.mock.calls[0][0];
      expect(logOutput).toContain('[WARN]');
      expect(logOutput).toContain('Test warning message');
    });

    it('should log warning with context and data', () => {
      const testData = { reason: 'test' };
      logger.warn('Test warning', 'TestContext', testData);
      
      const logOutput = consoleSpy.warn.mock.calls[0][0];
      expect(logOutput).toContain('[WARN]');
      expect(logOutput).toContain('[TestContext]');
      expect(logOutput).toContain('Test warning');
      expect(logOutput).toContain('reason');
    });
  });

  describe('info', () => {
    it('should log info message to console.info', () => {
      logger.info('Test info message');
      
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain('[INFO]');
      expect(logOutput).toContain('Test info message');
    });

    it('should log info with context and data', () => {
      const testData = { action: 'login', userId: '123' };
      logger.info('User action', 'AuthService', testData);
      
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain('[INFO]');
      expect(logOutput).toContain('[AuthService]');
      expect(logOutput).toContain('User action');
      expect(logOutput).toContain('login');
    });
  });

  describe('debug', () => {
    it('should log debug message in non-production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      logger.debug('Test debug message');
      
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      const logOutput = consoleSpy.debug.mock.calls[0][0];
      expect(logOutput).toContain('[DEBUG]');
      expect(logOutput).toContain('Test debug message');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not log debug message in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      logger.debug('Test debug message');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should log debug with context and data in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const testData = { query: 'SELECT * FROM users' };
      logger.debug('Database query', 'DatabaseService', testData);
      
      const logOutput = consoleSpy.debug.mock.calls[0][0];
      expect(logOutput).toContain('[DEBUG]');
      expect(logOutput).toContain('[DatabaseService]');
      expect(logOutput).toContain('Database query');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('log formatting', () => {
    it('should format log with all components', () => {
      logger.info('Test message', 'TestContext', { data: 'value' });
      
      const logOutput = consoleSpy.info.mock.calls[0][0];
      // Should contain: timestamp, level, context, message, and data
      expect(logOutput).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // timestamp
      expect(logOutput).toContain('[INFO]'); // level
      expect(logOutput).toContain('[TestContext]'); // context
      expect(logOutput).toContain('Test message'); // message
      expect(logOutput).toContain('"data": "value"'); // data as JSON
    });

    it('should format log without context', () => {
      logger.info('Test message');
      
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain('[INFO]');
      expect(logOutput).toContain('Test message');
      expect(logOutput).not.toContain('[]'); // No empty context brackets
    });

    it('should format log without data', () => {
      logger.info('Test message', 'TestContext');
      
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain('[INFO]');
      expect(logOutput).toContain('[TestContext]');
      expect(logOutput).toContain('Test message');
      // Should not contain extra JSON formatting
      expect(logOutput).not.toContain('{');
    });

    it('should format complex nested data objects', () => {
      const complexData = {
        user: { id: '123', name: 'Test' },
        metadata: { action: 'test', timestamp: new Date().toISOString() }
      };
      logger.info('Complex log', 'TestContext', complexData);
      
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain('user');
      expect(logOutput).toContain('metadata');
      expect(logOutput).toContain('123');
      expect(logOutput).toContain('Test');
    });
  });
});

describe('LogLevel enum', () => {
  it('should have all required log levels', () => {
    expect(LogLevel.ERROR).toBe('ERROR');
    expect(LogLevel.WARN).toBe('WARN');
    expect(LogLevel.INFO).toBe('INFO');
    expect(LogLevel.DEBUG).toBe('DEBUG');
  });
});
