const express = require('express');
const {
  createOrder,
  getUserOrders,
  getOrder,
  cancelOrder,
  trackOrder,
  getOrderInvoice,
  createPaymentOrder
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

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