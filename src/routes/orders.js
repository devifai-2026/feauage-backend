const express = require('express');
const {
  createOrder,
  getUserOrders,
  getOrder,
  cancelOrder,
  trackOrder,
  getOrderInvoice,
  createPaymentOrder,
  getRecentActivity
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/recent-activity', getRecentActivity);

// All routes require authentication
router.use(protect);

router.get('/', getUserOrders);
router.get('/:id', getOrder);
router.get('/:id/track', trackOrder);
router.get('/:id/invoice', getOrderInvoice);
router.post('/', createOrder);
router.patch('/:id/cancel', cancelOrder);
router.post('/:id/create-payment', createPaymentOrder);

module.exports = router;