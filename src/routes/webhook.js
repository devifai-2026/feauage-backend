const express = require('express');
const {
  handleRazorpayWebhook,
  handleShiprocketWebhook
} = require('../controllers/paymentController');

const router = express.Router();

// Webhook endpoints (no authentication required - called by external services)
router.post('/razorpay', handleRazorpayWebhook);
router.post('/shiprocket', handleShiprocketWebhook);

module.exports = router;