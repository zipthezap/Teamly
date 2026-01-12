import { Router } from 'express';
import {
  createComment,
  getEventComments,
  updateComment,
  deleteComment
} from '../controllers/commentController';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Create a comment
router.post('/', authMiddleware, asyncHandler(createComment));

// Get comments for an event
router.get('/event/:eventId', authMiddleware, asyncHandler(getEventComments));

// Update a comment
router.put('/:commentId', authMiddleware, asyncHandler(updateComment));

// Delete a comment
router.delete('/:commentId', authMiddleware, asyncHandler(deleteComment));

export default router;
