/**
 * Example: Migrating a Controller to Use New Backend Improvements
 * 
 * This file demonstrates how to migrate an existing controller
 * to use the new error handling, async handlers, and other improvements.
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../../src/backend/middleware/asyncHandler';
import { 
  BadRequestError, 
  NotFoundError, 
  ForbiddenError,
  ConflictError 
} from '../../src/backend/utils/errors';
import { isRequired, validateUUID } from '../../src/backend/utils/validation';
import prisma from '../../src/backend/config/database';
import { logger } from '../../src/backend/utils/logger';

// ============================================================================
// BEFORE: Traditional approach with try-catch blocks
// ============================================================================

export const oldGetUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    logger.error('Failed to get user', 'UserController', { error });
    res.status(500).json({ error: 'Failed to get user' });
  }
};

export const oldCreateUser = async (req: Request, res: Response) => {
  try {
    const { email, name, password } = req.body;
    
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    const user = await prisma.user.create({
      data: { email, name, password },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });
    
    res.status(201).json(user);
  } catch (error) {
    logger.error('Failed to create user', 'UserController', { error });
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const oldUpdateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });
    
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user is authorized
    if (existingUser.id !== req.user?.id) {
      return res.status(403).json({ error: 'Unauthorized to update this user' });
    }
    
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { name, email },
      select: {
        id: true,
        email: true,
        name: true,
        updatedAt: true
      }
    });
    
    res.json(updatedUser);
  } catch (error) {
    logger.error('Failed to update user', 'UserController', { error });
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// ============================================================================
// AFTER: Using new backend improvements
// ============================================================================

/**
 * Get a user by ID
 * Benefits:
 * - No try-catch needed (asyncHandler handles it)
 * - Semantic error classes
 * - Automatic error logging and response formatting
 * - Validation helpers
 * - 40% less code
 */
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Validation - throws error if invalid
  isRequired(id, 'User ID');
  validateUUID(id, 'User ID');
  
  // Database query - errors are caught by asyncHandler
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  });
  
  // Throw semantic error if not found
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  res.json(user);
});

/**
 * Create a new user
 * Benefits:
 * - Semantic errors make intent clear
 * - Automatic error handling
 * - Cleaner validation
 */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  
  // Validate required fields
  isRequired(email, 'Email');
  isRequired(name, 'Name');
  isRequired(password, 'Password');
  
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  
  if (existingUser) {
    throw new ConflictError('User already exists');
  }
  
  // Create user
  const user = await prisma.user.create({
    data: { email, name, password },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  });
  
  res.status(201).json(user);
});

/**
 * Update a user
 * Benefits:
 * - Authorization check is clearer
 * - Semantic errors
 * - Less boilerplate
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email } = req.body;
  
  // Validate ID
  isRequired(id, 'User ID');
  validateUUID(id, 'User ID');
  
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id }
  });
  
  if (!existingUser) {
    throw new NotFoundError('User not found');
  }
  
  // Check authorization
  if (existingUser.id !== req.user?.id) {
    throw new ForbiddenError('Unauthorized to update this user');
  }
  
  // Update user
  const updatedUser = await prisma.user.update({
    where: { id },
    data: { name, email },
    select: {
      id: true,
      email: true,
      name: true,
      updatedAt: true
    }
  });
  
  res.json(updatedUser);
});

// ============================================================================
// ADVANCED: Using custom validation and error handling
// ============================================================================

/**
 * Advanced example showing custom validation and business logic errors
 */
export const advancedExample = asyncHandler(async (req: Request, res: Response) => {
  const { userId, action } = req.body;
  
  // Validate inputs
  isRequired(userId, 'User ID');
  isRequired(action, 'Action');
  
  // Custom business logic validation
  const validActions = ['activate', 'deactivate', 'delete'];
  if (!validActions.includes(action)) {
    throw new BadRequestError(
      `Invalid action. Must be one of: ${validActions.join(', ')}`,
      'INVALID_ACTION'
    );
  }
  
  // Check if user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Check authorization with custom message
  if (!req.user?.id) {
    throw new UnauthorizedError('You must be logged in to perform this action');
  }
  
  // Business rule: only admins can delete users
  if (action === 'delete' && !req.user.isAdmin) {
    throw new ForbiddenError('Only administrators can delete users', 'ADMIN_ONLY');
  }
  
  // Perform action (simplified for example)
  logger.info(`User ${req.user.id} performed ${action} on user ${userId}`, 'UserController');
  
  res.json({ 
    success: true, 
    message: `User ${action} successful` 
  });
});

// ============================================================================
// COMPARISON SUMMARY
// ============================================================================

/**
 * Old Approach:
 * - Requires try-catch in every function
 * - Manual error status codes and messages
 * - Manual error logging
 * - Harder to maintain consistency
 * - More boilerplate code
 * - Error details easily inconsistent
 * 
 * New Approach:
 * - No try-catch needed (asyncHandler)
 * - Semantic error classes with built-in status codes
 * - Automatic error logging with request context
 * - Consistent error responses
 * - ~40% less code
 * - Better error semantics
 * - Request tracking via unique IDs
 * - Automatic input sanitization
 * 
 * Migration is gradual - old and new approaches can coexist
 */
