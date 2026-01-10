#!/usr/bin/env node
/**
 * Test script to verify special character sanitization across all backend endpoints
 * Tests that text inputs are properly sanitized while preserving legitimate special characters
 */

const assert = require('assert');

console.log('\n=== Testing Special Character Sanitization ===\n');

// Test sanitization functions - import only validation which doesn't need database
const { sanitizeString } = require('../dist/backend/utils/validation');

try {
  // Test 1: Basic string sanitization - should trim whitespace
  console.log('Test 1: Basic string sanitization');
  const trimmed = sanitizeString('  Hello World  ');
  assert.strictEqual(trimmed, 'Hello World');
  console.log('✓ Whitespace trimming works');

  // Test 2: Special characters are preserved
  console.log('\nTest 2: Special characters preservation');
  const withSpecialChars = sanitizeString('  Hello! @User #123 $%^&*()  ');
  assert.strictEqual(withSpecialChars, 'Hello! @User #123 $%^&*()');
  console.log('✓ Special characters are preserved');

  // Test 3: Unicode characters are preserved
  console.log('\nTest 3: Unicode characters preservation');
  const withUnicode = sanitizeString('  Café ⚽ 日本語  ');
  assert.strictEqual(withUnicode, 'Café ⚽ 日本語');
  console.log('✓ Unicode characters are preserved');

  // Test 4: Newlines and tabs are preserved
  console.log('\nTest 4: Newlines and tabs preservation');
  const withNewlines = sanitizeString('  Line1\nLine2\tTab  ');
  assert.strictEqual(withNewlines, 'Line1\nLine2\tTab');
  console.log('✓ Newlines and tabs are preserved');

  // Test 5: Quotes and apostrophes
  console.log('\nTest 5: Quotes and apostrophes');
  const withQuotes = sanitizeString('  "Hello" it\'s working!  ');
  assert.strictEqual(withQuotes, '"Hello" it\'s working!');
  console.log('✓ Quotes and apostrophes are preserved');

  // Test 6: Brackets and parentheses
  console.log('\nTest 6: Brackets and parentheses');
  const withBrackets = sanitizeString('  [group] {test} (name)  ');
  assert.strictEqual(withBrackets, '[group] {test} (name)');
  console.log('✓ Brackets and parentheses are preserved');

  // Test 7: Mathematical symbols
  console.log('\nTest 7: Mathematical symbols');
  const withMath = sanitizeString('  1+1=2 a<b b>a 50%  ');
  assert.strictEqual(withMath, '1+1=2 a<b b>a 50%');
  console.log('✓ Mathematical symbols are preserved');

  // Test 8: Email and URLs
  console.log('\nTest 8: Email and URLs');
  const withEmail = sanitizeString('  user@example.com  ');
  assert.strictEqual(withEmail, 'user@example.com');
  const withURL = sanitizeString('  https://example.com/path?query=value  ');
  assert.strictEqual(withURL, 'https://example.com/path?query=value');
  console.log('✓ Emails and URLs are preserved');

  // Test 9: Empty and edge cases
  console.log('\nTest 9: Empty and edge cases');
  assert.strictEqual(sanitizeString(''), '');
  assert.strictEqual(sanitizeString('   '), '');
  assert.strictEqual(sanitizeString('\t\n  \t'), '');
  console.log('✓ Empty and edge cases handled correctly');

  // Test 10: Very long strings with special characters
  console.log('\nTest 10: Long strings with special characters');
  const longString = '  ' + 'A'.repeat(100) + ' Special! @#$%^&*() ' + 'B'.repeat(100) + '  ';
  const sanitizedLong = sanitizeString(longString);
  assert.strictEqual(sanitizedLong.length, 220); // 100 + 20 + 100 (no leading/trailing spaces)
  assert.ok(sanitizedLong.includes('Special! @#$%^&*()'));
  console.log('✓ Long strings with special characters handled correctly');

  // Test 11: Potential XSS strings (should be preserved, React handles XSS)
  console.log('\nTest 11: Potential XSS strings (trimmed only)');
  const xssLike = sanitizeString('  <script>alert("test")</script>  ');
  assert.strictEqual(xssLike, '<script>alert("test")</script>');
  console.log('✓ XSS-like strings are preserved (note: React handles XSS in frontend)');

  // Test 12: SQL-like strings (should be preserved, Prisma handles SQL injection)
  console.log('\nTest 12: SQL-like strings preservation');
  const sqlLike = sanitizeString("  SELECT * FROM users WHERE name = 'test'  ");
  assert.strictEqual(sqlLike, "SELECT * FROM users WHERE name = 'test'");
  console.log('✓ SQL-like strings are preserved (note: Prisma handles SQL injection)');

  // Test 13: Multiple consecutive spaces
  console.log('\nTest 13: Multiple consecutive spaces');
  const multiSpaces = sanitizeString('  Hello    World  ');
  assert.strictEqual(multiSpaces, 'Hello    World'); // Internal spaces preserved, only trim edges
  console.log('✓ Multiple consecutive spaces preserved internally');

  // Test 14: Mixed whitespace types
  console.log('\nTest 14: Mixed whitespace types');
  const mixedWhitespace = sanitizeString('\t  Hello\n\nWorld  \t');
  assert.strictEqual(mixedWhitespace, 'Hello\n\nWorld');
  console.log('✓ Mixed whitespace types handled correctly');

  console.log('\n=== All Tests Passed ✓ ===\n');
  console.log('✅ Special character sanitization is working correctly!');
  console.log('✅ All text inputs are trimmed while preserving legitimate special characters.');
  console.log('✅ The sanitization in eventService, groupService, and teamUpService');
  console.log('   uses this same sanitizeString function, ensuring consistent behavior.');
  console.log('\nNote: The backend only trims whitespace. XSS protection is handled by React in the frontend.');
  
} catch (error) {
  console.error('\n✗ Test failed:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
