import { Router } from 'express';
import {
  createComment,
  getEventComments,
  updateComment,
  deleteComment
} from '../controllers/commentController';
import authMiddleware from '../middleware/auth';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// Create a comment
router.post('/', authMiddleware, noCache, createComment);

// Get comments for an event
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/event/:eventId', authMiddleware, etagMiddleware({ weak: true }), getEventComments);

// Update a comment
router.put('/:commentId', authMiddleware, noCache, updateComment);

// Delete a comment
router.delete('/:commentId', authMiddleware, noCache, deleteComment);

export default router;
