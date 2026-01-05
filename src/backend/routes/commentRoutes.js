const express = require('express');
const router = express.Router();

const {
  createComment,
  getEventComments,
  updateComment,
  deleteComment
} = require('../controllers/commentController');
const authMiddleware = require('../middleware/auth');


// Create a comment
router.post('/', authMiddleware, createComment);

// Get comments for an event
router.get('/event/:eventId', authMiddleware, getEventComments);

// Update a comment
router.put('/:commentId', authMiddleware, updateComment);

// Delete a comment
router.delete('/:commentId', authMiddleware, deleteComment);

module.exports = router;
