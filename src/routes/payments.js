const express = require('express');
const {
  createPaymentLink,
  handlePaymentCallback,
  verifyPayment,
  getPaymentStatus,
  createRefund,
  processS2SCardPayment,
  handleS2SCallback
} = require('../controllers/paymentController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Public routes - Payment callbacks (Razorpay redirects here after payment)
router.get('/callback', handlePaymentCallback);
router.post('/s2s-callback', handleS2SCallback);

// Protected routes - require authentication
router.use(protect);

// Create payment link (returns URL to redirect user to Razorpay)
router.post('/create-payment-link', createPaymentLink);

// Process card payment via S2S API
router.post('/process-card', processS2SCardPayment);

// Verify Razorpay payment (manual verification if needed)
router.post('/verify', verifyPayment);

// Get payment status for an order
router.get('/status/:orderId', getPaymentStatus);

// Create refund (admin only)
router.post('/refund', restrictTo('admin', 'superadmin'), createRefund);

module.exports = router;
