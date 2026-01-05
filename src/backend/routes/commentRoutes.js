const express = require('express');
const router = express.Router();
const {
  createComment,
  getEventComments,
  updateComment,
  deleteComment
} = require('../controllers/commentController');
const { authenticate } = require('../middleware/auth');

// Create a comment
router.post('/', authenticate, createComment);

// Get comments for an event
router.get('/event/:eventId', authenticate, getEventComments);

// Update a comment
router.put('/:commentId', authenticate, updateComment);

// Delete a comment
router.delete('/:commentId', authenticate, deleteComment);

module.exports = router;
