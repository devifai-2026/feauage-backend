const crypto = require('crypto');
const Order = require('../models/Order');
const User = require('../models/User');
const Webhook = require('../models/Webhook');
const { emitOrderNotification } = require('../sockets/orderSocket');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const razorpay = require('../configs/razorpay');

// @desc    Verify Razorpay payment
// @route   POST /api/v1/payments/verify
// @access  Private
exports.verifyPayment = catchAsync(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
  
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
    return next(new AppError('Missing required parameters', 400));
  }
  
  // Find order
  const order = await Order.findOne({ 
    orderId,
    razorpayOrderId: razorpay_order_id 
  });
  
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  // Check if order belongs to user
  if (order.user.toString() !== req.user.id) {
    return next(new AppError('Not authorized to verify this payment', 403));
  }
  
  // Verify signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');
  
  if (expectedSignature !== razorpay_signature) {
    return next(new AppError('Invalid payment signature', 400));
  }
  
  // Update order payment status
  order.paymentStatus = 'paid';
  order.razorpayPaymentId = razorpay_payment_id;
  order.razorpaySignature = razorpay_signature;
  order.status = 'confirmed'; // Move to confirmed status
  await order.save();
  
  // Get user details for notification
  const user = await User.findById(order.user);
  
  // Emit payment received notification
  emitOrderNotification('payment_received', {
    orderId: order.orderId,
    paymentId: razorpay_payment_id,
    amount: order.grandTotal,
    userId: order.user,
    userName: user.fullName
  });
  
  res.status(200).json({
    status: 'success',
    message: 'Payment verified successfully',
    data: {
      order
    }
  });
});

// @desc    Handle Razorpay webhook
// @route   POST /api/v1/webhooks/razorpay
// @access  Public (called by Razorpay)
exports.handleRazorpayWebhook = catchAsync(async (req, res, next) => {
  const webhookSignature = req.headers['x-razorpay-signature'];
  
  if (!webhookSignature) {
    return next(new AppError('Missing webhook signature', 400));
  }
  
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (webhookSignature !== expectedSignature) {
    return next(new AppError('Invalid webhook signature', 400));
  }
  
  const event = req.body.event;
  const payload = req.body.payload;
  
  // Log webhook
  await Webhook.create({
    type: 'razorpay',
    event,
    payload: req.body
  });
  
  // Handle different events
  switch (event) {
    case 'payment.captured':
      await handlePaymentCaptured(payload);
      break;
      
    case 'payment.failed':
      await handlePaymentFailed(payload);
      break;
      
    case 'order.paid':
      await handleOrderPaid(payload);
      break;
      
    case 'refund.created':
      await handleRefundCreated(payload);
      break;
      
    case 'refund.processed':
      await handleRefundProcessed(payload);
      break;
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Webhook received'
  });
});

// @desc    Get payment status
// @route   GET /api/v1/payments/status/:orderId
// @access  Private
exports.getPaymentStatus = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({ 
    orderId: req.params.orderId,
    user: req.user.id 
  });
  
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  // For Razorpay payments, you might want to check with Razorpay API
  let paymentDetails = null;
  
  if (order.razorpayPaymentId) {
    try {
      paymentDetails = await razorpay.payments.fetch(order.razorpayPaymentId);
    } catch (error) {
      console.error('Error fetching payment details:', error);
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      paymentDetails
    }
  });
});

// @desc    Create refund
// @route   POST /api/v1/payments/refund
// @access  Private/Admin
exports.createRefund = catchAsync(async (req, res, next) => {
  const { orderId, amount, reason } = req.body;
  
  const order = await Order.findOne({ orderId });
  
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  if (order.paymentStatus !== 'paid') {
    return next(new AppError('Order is not paid', 400));
  }
  
  if (!order.razorpayPaymentId) {
    return next(new AppError('No payment found for this order', 400));
  }
  
  const refundAmount = amount || order.grandTotal;
  
  try {
    // Create refund via Razorpay
    const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
      amount: Math.round(refundAmount * 100), // Amount in paise
      notes: {
        reason: reason || 'Customer request',
        orderId: order.orderId
      }
    });
    
    // Update order status
    if (refundAmount === order.grandTotal) {
      order.paymentStatus = 'refunded';
    } else {
      order.paymentStatus = 'partially_refunded';
    }
    
    order.status = 'refunded';
    await order.save();
    
    // Get user for notification
    const user = await User.findById(order.user);
    
    // Emit refund notification
    emitOrderNotification('refund_processed', {
      orderId: order.orderId,
      refundId: refund.id,
      amount: refundAmount,
      userId: order.user,
      userName: user.fullName
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Refund initiated successfully',
      data: {
        refund,
        order
      }
    });
  } catch (error) {
    console.error('Refund creation failed:', error);
    return next(new AppError('Refund creation failed', 500));
  }
});

// Helper functions for webhook handling
async function handlePaymentCaptured(payload) {
  const { payment } = payload;
  
  // Find order by Razorpay order ID
  const order = await Order.findOne({ razorpayOrderId: payment.order_id });
  
  if (order) {
    order.paymentStatus = 'paid';
    order.razorpayPaymentId = payment.id;
    order.status = 'confirmed';
    await order.save();
    
    // Get user for notification
    const user = await User.findById(order.user);
    
    // Emit payment captured notification
    emitOrderNotification('payment_captured', {
      orderId: order.orderId,
      paymentId: payment.id,
      amount: payment.amount / 100, // Convert from paise to rupees
      userId: order.user,
      userName: user.fullName
    });
  }
}

async function handlePaymentFailed(payload) {
  const { payment } = payload;
  
  // Find order by Razorpay order ID
  const order = await Order.findOne({ razorpayOrderId: payment.order_id });
  
  if (order) {
    order.paymentStatus = 'failed';
    await order.save();
    
    // Get user for notification
    const user = await User.findById(order.user);
    
    // Emit payment failed notification
    emitOrderNotification('payment_failed', {
      orderId: order.orderId,
      paymentId: payment.id,
      amount: payment.amount / 100,
      userId: order.user,
      userName: user.fullName,
      error: payment.error_description
    });
  }
}

async function handleOrderPaid(payload) {
  const { order } = payload;
  
  // Find order by Razorpay order ID
  const dbOrder = await Order.findOne({ razorpayOrderId: order.id });
  
  if (dbOrder) {
    dbOrder.paymentStatus = 'paid';
    dbOrder.status = 'confirmed';
    await dbOrder.save();
  }
}

async function handleRefundCreated(payload) {
  const { refund } = payload;
  
  // Update order status based on refund
  const payment = await razorpay.payments.fetch(refund.payment_id);
  const dbOrder = await Order.findOne({ razorpayPaymentId: payment.id });
  
  if (dbOrder) {
    if (refund.amount === payment.amount) {
      dbOrder.paymentStatus = 'refunded';
    } else {
      dbOrder.paymentStatus = 'partially_refunded';
    }
    
    dbOrder.status = 'refunded';
    await dbOrder.save();
  }
}

async function handleRefundProcessed(payload) {
  const { refund } = payload;

  // Log refund processed
  console.log('Refund processed:', refund.id);
}

// =====================================================
// SHIPROCKET WEBHOOK HANDLER
// =====================================================

// @desc    Handle Shiprocket webhook events
// @route   POST /api/v1/webhooks/shiprocket
// @access  Public (called by Shiprocket)
exports.handleShiprocketWebhook = catchAsync(async (req, res, next) => {
  const webhookToken = req.headers['x-api-key'] || req.query.token;

  // Verify webhook token (optional but recommended)
  if (process.env.SHIPROCKET_WEBHOOK_SECRET && webhookToken !== process.env.SHIPROCKET_WEBHOOK_SECRET) {
    console.warn('Shiprocket webhook: Invalid token');
    // Still process but log warning - Shiprocket doesn't always send consistent auth
  }

  const payload = req.body;

  // Log webhook
  await Webhook.create({
    type: 'shiprocket',
    event: payload.current_status || 'unknown',
    payload
  });

  // Extract relevant data
  const {
    awb,
    order_id: shiprocketOrderId,
    current_status: currentStatus,
    current_status_id: statusId,
    shipment_id: shipmentId,
    etd,
    scans
  } = payload;

  // Find order by Shiprocket details
  let order = null;

  if (awb) {
    order = await Order.findOne({ shiprocketAWB: awb });
  }

  if (!order && shiprocketOrderId) {
    order = await Order.findOne({ shiprocketOrderId: shiprocketOrderId.toString() });
  }

  if (!order && shipmentId) {
    order = await Order.findOne({ shiprocketShipmentId: shipmentId.toString() });
  }

  if (!order) {
    console.log('Shiprocket webhook: Order not found for AWB/OrderId:', awb, shiprocketOrderId);
    // Return success anyway to prevent retries
    return res.status(200).json({ status: 'success', message: 'Order not found, webhook acknowledged' });
  }

  // Map Shiprocket status to our shipping status
  const statusMap = {
    '1': 'confirmed',        // AWB Assigned
    '2': 'processing',       // Label Generated
    '3': 'processing',       // Pickup Scheduled / Generated
    '4': 'processing',       // Pickup Queued
    '5': 'processing',       // Manifest Generated
    '6': 'shipped',          // Shipped / In Transit
    '7': 'shipped',          // Out For Delivery
    '8': 'delivered',        // Delivered
    '9': 'cancelled',        // Undelivered
    '10': 'returned',        // RTO Initiated
    '11': 'returned',        // RTO Delivered
    '12': 'cancelled',       // Cancelled
    '13': 'returned',        // RTO Acknowledged
    '14': 'shipped',         // Out For Pickup
    '15': 'processing',      // Pickup Exception
    '16': 'shipped',         // In Transit (Delayed)
    '17': 'shipped',         // Partial Delivered
    '18': 'returned',        // Lost
    '19': 'returned',        // Damaged
    '20': 'returned',        // Destroyed
    '38': 'shipped',         // Reached at Destination
    '39': 'shipped',         // Misrouted
    '40': 'shipped',         // Contact Customer Care
    '41': 'shipped',         // Shipment Booked
    '42': 'shipped'          // In Transit to Destination
  };

  const previousShippingStatus = order.shippingStatus;
  const newShippingStatus = statusMap[statusId] || order.shippingStatus;

  // Update order
  order.shippingStatus = newShippingStatus;

  // Update tracking number if not set
  if (awb && !order.trackingNumber) {
    order.trackingNumber = awb;
  }

  // Update estimated delivery if provided
  if (etd) {
    order.estimatedDelivery = new Date(etd);
  }

  // Handle delivery
  if (newShippingStatus === 'delivered') {
    order.status = 'delivered';
    order.deliveredAt = new Date();

    // Emit delivery notification
    emitOrderNotification('order_delivered', {
      orderId: order.orderId,
      userId: order.user,
      awb
    });
  }

  // Handle cancellation/RTO
  if (['cancelled', 'returned'].includes(newShippingStatus)) {
    if (newShippingStatus === 'returned') {
      order.status = 'returned';
    }

    // Emit notification
    emitOrderNotification('shipping_issue', {
      orderId: order.orderId,
      userId: order.user,
      status: currentStatus,
      awb
    });
  }

  await order.save();

  // Emit general shipping update notification
  if (previousShippingStatus !== newShippingStatus) {
    emitOrderNotification('shipping_status_updated', {
      orderId: order.orderId,
      previousStatus: previousShippingStatus,
      newStatus: newShippingStatus,
      currentStatus,
      awb,
      userId: order.user
    });
  }

  console.log(`Shiprocket webhook processed: Order ${order.orderId}, Status: ${currentStatus} (${statusId})`);

  res.status(200).json({
    status: 'success',
    message: 'Webhook processed successfully'
  });
});