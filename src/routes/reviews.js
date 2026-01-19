const express = require('express');
const {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  markHelpful,
  reportReview,
  getUserReviews
} = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/product/:productId', getProductReviews);
router.get('/user/:userId', getUserReviews);

// Protected routes
router.use(protect);
router.post('/', createReview);
router.patch('/:id', updateReview);
router.delete('/:id', deleteReview);
router.post('/:id/helpful', markHelpful);
router.post('/:id/report', reportReview);

module.exports = router;