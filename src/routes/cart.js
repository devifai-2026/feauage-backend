const express = require('express');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  applyCoupon,
  removeCoupon,
  getCartCount,
  checkCartStock
} = require('../controllers/cartController');
const { identify } = require('../middleware/auth');

const router = express.Router();

// Allow both authenticated users and guests
router.use(identify);

router.get('/', getCart);
router.get('/count', getCartCount);
router.get('/check-stock', checkCartStock);
router.post('/items', addToCart);
router.patch('/items/:itemId', updateCartItem);
router.delete('/items/:itemId', removeCartItem);
router.delete('/', clearCart);
router.post('/apply-coupon', applyCoupon);
router.delete('/remove-coupon', removeCoupon);

module.exports = router;