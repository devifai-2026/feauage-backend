const express = require('express');
const {
  handleRazorpayWebhook
} = require('../controllers/paymentController');

const router = express.Router();

// Webhook endpoints (no authentication required - called by external services)
router.post('/razorpay', handleRazorpayWebhook);

module.exports = router;