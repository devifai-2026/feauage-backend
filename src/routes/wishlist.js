const express = require('express');
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  checkInWishlist,
  getWishlistCount,
  moveToCart
} = require('../controllers/wishlistController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/', getWishlist);
router.get('/count', getWishlistCount);
router.get('/check/:productId', checkInWishlist);
router.post('/items', addToWishlist);
router.delete('/items/:productId', removeFromWishlist);
router.delete('/', clearWishlist);
router.post('/move-to-cart/:productId', moveToCart);

module.exports = router;