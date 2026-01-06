import { Router } from 'express';
import {
  createComment,
  getEventComments,
  updateComment,
  deleteComment
} from '../controllers/commentController';
import authMiddleware from '../middleware/auth';

const router = Router();

// Create a comment
router.post('/', authMiddleware, createComment);

// Get comments for an event
router.get('/event/:eventId', authMiddleware, getEventComments);

// Update a comment
router.put('/:commentId', authMiddleware, updateComment);

// Delete a comment
router.delete('/:commentId', authMiddleware, deleteComment);

export default router;
