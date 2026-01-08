#!/usr/bin/env node
/**
 * Test script for backend improvements
 * Demonstrates the new features and validates they work correctly
 */

const assert = require('assert');

// Test 1: Custom Error Classes
console.log('\n=== Testing Custom Error Classes ===');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../dist/backend/utils/errors');

try {
  const badReqError = new BadRequestError('Invalid input', 'INVALID_INPUT');
  assert.strictEqual(badReqError.statusCode, 400);
  assert.strictEqual(badReqError.message, 'Invalid input');
  assert.strictEqual(badReqError.code, 'INVALID_INPUT');
  console.log('✓ BadRequestError works correctly');

  const notFoundError = new NotFoundError('Resource not found');
  assert.strictEqual(notFoundError.statusCode, 404);
  console.log('✓ NotFoundError works correctly');

  const authError = new UnauthorizedError('Not authenticated');
  assert.strictEqual(authError.statusCode, 401);
  console.log('✓ UnauthorizedError works correctly');
} catch (error) {
  console.error('✗ Error class test failed:', error.message);
  process.exit(1);
}

// Test 2: Validation Utilities
console.log('\n=== Testing Validation Utilities ===');
const validation = require('../dist/backend/utils/validation');

try {
  // Test email validation
  assert.strictEqual(validation.isValidEmail('test@example.com'), true);
  assert.strictEqual(validation.isValidEmail('invalid-email'), false);
  console.log('✓ Email validation works');

  // Test UUID validation
  assert.strictEqual(validation.isValidUUID('123e4567-e89b-12d3-a456-426614174000'), true);
  assert.strictEqual(validation.isValidUUID('not-a-uuid'), false);
  console.log('✓ UUID validation works');

  // Test HTML escaping
  const escaped = validation.escapeHtml('<script>alert("xss")</script>');
  assert.strictEqual(escaped.includes('<script>'), false);
  assert.strictEqual(escaped.includes('&lt;script&gt;'), true);
  console.log('✓ HTML escaping works');

  // Test string sanitization
  const sanitized = validation.sanitizeString('  test  ');
  assert.strictEqual(sanitized, 'test');
  console.log('✓ String sanitization works');
} catch (error) {
  console.error('✗ Validation test failed:', error.message);
  process.exit(1);
}

// Test 3: Configuration
console.log('\n=== Testing Configuration ===');
const { config } = require('../dist/backend/config/appConfig');

try {
  assert.strictEqual(typeof config.port, 'number');
  assert.strictEqual(typeof config.nodeEnv, 'string');
  assert.strictEqual(typeof config.isProduction, 'boolean');
  assert.strictEqual(typeof config.isDevelopment, 'boolean');
  console.log('✓ Configuration loads correctly');
  console.log(`  - Port: ${config.port}`);
  console.log(`  - Environment: ${config.nodeEnv}`);
  console.log(`  - Is Production: ${config.isProduction}`);
} catch (error) {
  console.error('✗ Configuration test failed:', error.message);
  process.exit(1);
}

// Test 4: Logger
console.log('\n=== Testing Logger ===');
const { logger } = require('../dist/backend/utils/logger');

try {
  // Test that logger methods exist and can be called
  logger.info('Test info message', 'TestContext');
  logger.warn('Test warning message', 'TestContext');
  logger.error('Test error message', 'TestContext', { detail: 'test' });
  console.log('✓ Logger works correctly');
} catch (error) {
  console.error('✗ Logger test failed:', error.message);
  process.exit(1);
}

// Test 5: Async Handler
console.log('\n=== Testing Async Handler ===');
const { asyncHandler } = require('../dist/backend/middleware/asyncHandler');

try {
  const mockReq = {};
  const mockRes = { json: (data) => data };
  const mockNext = (error) => {
    assert.ok(error);
    assert.strictEqual(error.message, 'Test error');
  };

  // Test that async errors are caught
  const handler = asyncHandler(async (req, res) => {
    throw new Error('Test error');
  });

  handler(mockReq, mockRes, mockNext);
  console.log('✓ Async handler catches errors correctly');
} catch (error) {
  console.error('✗ Async handler test failed:', error.message);
  process.exit(1);
}

// Test 6: Sanitization
console.log('\n=== Testing Input Sanitization ===');
const { sanitizeInput } = require('../dist/backend/middleware/sanitizeInput');

try {
  const mockReq = {
    body: {
      name: '  John  ',
      message: '<script>alert("xss")</script>',
      password: 'secret123'
    },
    query: {
      search: '  test  '
    },
    params: {
      id: '  123  '
    }
  };
  const mockRes = {};
  const mockNext = () => {};

  sanitizeInput(mockReq, mockRes, mockNext);

  // Check that strings are trimmed
  assert.strictEqual(mockReq.body.name, 'John');
  assert.strictEqual(mockReq.query.search, 'test');
  assert.strictEqual(mockReq.params.id, '123');

  // Check that HTML is escaped except for password
  assert.ok(mockReq.body.message.includes('&lt;'));
  assert.strictEqual(mockReq.body.password, 'secret123'); // Password should be trimmed but not escaped

  console.log('✓ Input sanitization works correctly');
} catch (error) {
  console.error('✗ Sanitization test failed:', error.message);
  process.exit(1);
}

console.log('\n=== All Tests Passed ✓ ===\n');
console.log('Backend improvements are working correctly!');
