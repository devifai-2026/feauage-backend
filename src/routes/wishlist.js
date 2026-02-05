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
const { identify } = require('../middleware/auth');

const router = express.Router();

// Allow both authenticated users and guests
router.use(identify);

router.get('/', getWishlist);
router.get('/count', getWishlistCount);
router.get('/check/:productId', checkInWishlist);
router.post('/items', addToWishlist);
router.delete('/items/:productId', removeFromWishlist);
router.delete('/', clearWishlist);
router.post('/move-to-cart/:productId', moveToCart);

module.exports = router;