const crypto = require('crypto');
const axios = require('axios');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderAddress = require('../models/OrderAddress');
const User = require('../models/User');
const Webhook = require('../models/Webhook');
const ShippingService = require('../services/shippingService');
const { emitOrderNotification } = require('../sockets/orderSocket');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const razorpay = require('../configs/razorpay');

// Initialize shipping service
const shippingService = new ShippingService();

// @desc    Create Razorpay payment link for an order (redirect-based flow)
// @route   POST /api/v1/payments/create-payment-link
// @access  Private
exports.createPaymentLink = catchAsync(async (req, res, next) => {
  const { orderId } = req.body;

  if (!orderId) {
    return next(new AppError('Order ID is required', 400));
  }

  // Find order
  let order = await Order.findOne({ orderId, user: req.user.id });
  if (!order) {
    order = await Order.findById(orderId);
    if (!order || order.user.toString() !== req.user.id) {
      return next(new AppError('Order not found', 404));
    }
  }

  // Check if already paid
  if (order.paymentStatus === 'paid') {
    return next(new AppError('Order is already paid', 400));
  }

  // Get user details
  const user = await User.findById(req.user.id);

  // Create Razorpay Payment Link
  const paymentLinkData = {
    amount: Math.round(order.grandTotal * 100), // Amount in paise
    currency: 'INR',
    accept_partial: false,
    description: `Payment for Order #${order.orderId}`,
    customer: {
      name: user.fullName || `${user.firstName} ${user.lastName}`,
      email: user.email,
      contact: user.phone || ''
    },
    notify: {
      sms: true,
      email: true
    },
    reminder_enable: true,
    notes: {
      orderId: order.orderId,
      orderObjectId: order._id.toString(),
      userId: req.user.id
    },
    // Callback goes to backend, which verifies payment and redirects to frontend
    callback_url: `${process.env.SERVER_URL || 'http://localhost:5001'}/api/v1/payments/callback?orderId=${order.orderId}`,
    callback_method: 'get'
  };

  try {
    const paymentLink = await razorpay.paymentLink.create(paymentLinkData);

    // Store payment link ID in order
    order.razorpayPaymentLinkId = paymentLink.id;
    order.razorpayOrderId = paymentLink.id; // Use payment link ID as reference
    await order.save();

    res.status(200).json({
      status: 'success',
      data: {
        paymentUrl: paymentLink.short_url,
        paymentLinkId: paymentLink.id,
        amount: order.grandTotal,
        orderId: order.orderId
      }
    });
  } catch (error) {
    console.error('Razorpay payment link creation failed:', error);
    return next(new AppError('Failed to create payment link', 500));
  }
});

// @desc    Handle payment callback (redirect from Razorpay)
// @route   GET /api/v1/payments/callback
// @access  Public
exports.handlePaymentCallback = catchAsync(async (req, res, next) => {
  const {
    razorpay_payment_id,
    razorpay_payment_link_id,
    razorpay_payment_link_reference_id,
    razorpay_payment_link_status,
    razorpay_signature,
    orderId
  } = req.query;

  // Find order
  let order = await Order.findOne({ orderId });
  if (!order) {
    // Redirect to failure page
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-status?status=failed&error=Order not found`);
  }

  // If payment was successful
  if (razorpay_payment_link_status === 'paid' && razorpay_payment_id) {
    // Verify signature
    const body = razorpay_payment_link_id + '|' + razorpay_payment_link_reference_id + '|' + razorpay_payment_link_status + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (razorpay_signature === expectedSignature) {
      // Payment verified
      order.paymentStatus = 'paid';
      order.razorpayPaymentId = razorpay_payment_id;
      order.razorpaySignature = razorpay_signature;
      order.status = 'confirmed';

      // Fetch actual payment method used (upi, card, netbanking, wallet, etc.)
      try {
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        if (paymentDetails.method) {
          order.paymentMethod = paymentDetails.method;
        }
      } catch (err) {
        console.error('Could not fetch payment method from Razorpay:', err.message);
      }

      await order.save();

      // Get user for notification
      const user = await User.findById(order.user);

      // Emit payment notification
      emitOrderNotification('payment_received', {
        orderId: order.orderId,
        paymentId: razorpay_payment_id,
        amount: order.grandTotal,
        userId: order.user,
        userName: user?.fullName || 'Customer'
      });

      // Create Shiprocket shipment asynchronously
      shippingService.processShipmentForOrder(order._id).catch(err => {
        console.error('Failed to create Shiprocket shipment:', err.message);
      });

      // Redirect to success page
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-status?status=success&orderId=${order.orderId}`);
    }
  }

  // Payment failed or signature mismatch
  order.paymentStatus = 'failed';
  await order.save();

  return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-status?status=failed&orderId=${order.orderId}`);
});

// @desc    Verify Razorpay payment (for manual verification if needed)
// @route   POST /api/v1/payments/verify
// @access  Private
exports.verifyPayment = catchAsync(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
    return next(new AppError('Missing required parameters', 400));
  }

  // Find order - try both orderId formats
  let order = await Order.findOne({
    orderId,
    razorpayOrderId: razorpay_order_id
  });

  // If not found, try finding by _id
  if (!order) {
    order = await Order.findOne({
      _id: orderId,
      razorpayOrderId: razorpay_order_id
    });
  }

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

  // Fetch actual payment method used (upi, card, netbanking, wallet, etc.)
  try {
    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    if (paymentDetails.method) {
      order.paymentMethod = paymentDetails.method;
    }
  } catch (err) {
    console.error('Could not fetch payment method from Razorpay:', err.message);
  }

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

  // Create Shiprocket shipment asynchronously (don't block response)
  shippingService.processShipmentForOrder(order._id).catch(err => {
    console.error('Failed to create Shiprocket shipment:', err.message);
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

// @desc    Process card payment via Razorpay S2S API
// @route   POST /api/v1/payments/process-card
// @access  Private
// NOTE: This endpoint handles raw card data. Never log card details.
// For production, ensure PCI DSS SAQ-D compliance.
exports.processS2SCardPayment = catchAsync(async (req, res, next) => {
  const { orderId, razorpayOrderId, card, amount } = req.body;

  // Validate inputs
  if (!orderId && !razorpayOrderId) {
    return next(new AppError('Order ID or Razorpay Order ID is required', 400));
  }
  if (!card || !card.number || !card.expiry_month || !card.expiry_year || !card.cvv || !card.name) {
    return next(new AppError('Complete card details are required', 400));
  }

  // Find order if orderId provided
  let order = null;
  if (orderId) {
    order = await Order.findOne({ orderId, user: req.user.id });
    if (!order) {
      order = await Order.findById(orderId);
      if (order && order.user.toString() !== req.user.id) order = null;
    }
  }

  // Determine totals and Razorpay Order ID
  let finalRazorpayOrderId = razorpayOrderId || order?.razorpayOrderId;
  let finalAmount = amount || order?.grandTotal;

  if (!finalAmount && order) finalAmount = order.grandTotal;

  if (!finalAmount) {
    return next(new AppError('Amount is required if order is not yet created', 400));
  }

  // Ensure Razorpay order exists if not provided
  if (!finalRazorpayOrderId) {
    try {
      const rzpOrder = await razorpay.orders.create({
        amount: Math.round(finalAmount * 100),
        currency: 'INR',
        receipt: orderId || `temp_${Date.now()}`,
        notes: { orderId: orderId || 'new_order', userId: req.user.id }
      });
      finalRazorpayOrderId = rzpOrder.id;
      if (order) {
        order.razorpayOrderId = finalRazorpayOrderId;
        await order.save();
      }
    } catch (err) {
      console.error('Razorpay order creation failed:', err);
      return next(new AppError('Failed to create payment order', 500));
    }
  }

  // Get user details
  const user = await User.findById(req.user.id);

  // Call Razorpay S2S API
  // Using the standard v1/payments endpoint for direct card processing
  const s2sPayload = {
    amount: Math.round(finalAmount * 100),
    currency: 'INR',
    email: user.email,
    contact: user.phone || '',
    order_id: finalRazorpayOrderId,
    method: 'card',
    card: {
      number: card.number.replace(/\s/g, ''),
      expiry_month: card.expiry_month,
      expiry_year: card.expiry_year,
      cvv: card.cvv,
      name: card.name,
    },
    callback_url: `${process.env.SERVER_URL || 'http://localhost:5001'}/api/v1/payments/s2s-callback?orderId=${orderId || 'new_order'}`
  };

  try {
    const params = new URLSearchParams();
    params.append('amount', Math.round(finalAmount * 100).toString());
    params.append('currency', 'INR');
    params.append('email', user.email);
    params.append('contact', user.phone || '');
    params.append('order_id', finalRazorpayOrderId);
    params.append('method', 'card');
    params.append('card[number]', card.number.replace(/\s/g, ''));
    params.append('card[expiry_month]', card.expiry_month);
    params.append('card[expiry_year]', card.expiry_year);
    params.append('card[cvv]', card.cvv);
    params.append('card[name]', card.name);
    params.append('callback_url', `${process.env.SERVER_URL || 'http://localhost:5001'}/api/v1/payments/s2s-callback?orderId=${orderId || 'new_order'}`);

    const response = await axios.post(
      'https://api.razorpay.com/v1/payments',
      params.toString(),
      {
        auth: {
          username: (process.env.RAZORPAY_KEY_ID || '').trim(),
          password: (process.env.RAZORPAY_KEY_SECRET || '').trim()
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const paymentId = response.data.razorpay_payment_id || response.data.id;

    // Store payment ID
    if (order) {
      order.razorpayPaymentId = paymentId;
      await order.save();
    }

    // Check if 3DS redirect is required
    // Razorpay S2S returns next actions in the 'next' array or 'redirect' field
    const nextActions = response.data.next || [];
    const redirectLink = response.data.links?.redirect || response.data.redirect_url;
    const redirectAction = nextActions.find(a => typeof a === 'string' ? a.includes('redirect') : a.action === 'redirect');
    const redirectUrl = redirectLink || (typeof redirectAction === 'string' ? redirectAction : redirectAction?.url);

    if (redirectUrl) {
      // 3DS required - return redirect URL for frontend popup
      if (order) {
        order.paymentStatus = 'processing';
        await order.save();
      }

      return res.status(200).json({
        status: 'success',
        data: {
          requiresRedirect: true,
          redirectUrl,
          razorpayPaymentId: paymentId,
          razorpayOrderId: finalRazorpayOrderId
        }
      });
    }

    // No 3DS - payment may be authorized or captured directly
    // Fetch payment to check status
    const paymentDetails = await razorpay.payments.fetch(paymentId);

    if (paymentDetails.status === 'authorized') {
      // Capture the payment
      await razorpay.payments.capture(paymentId, Math.round(finalAmount * 100), 'INR');
    }

    // Verify signature
    const body = finalRazorpayOrderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    // Update order as paid if it exists
    if (order) {
      order.paymentStatus = 'paid';
      order.razorpaySignature = expectedSignature;
      order.status = 'confirmed';
      await order.save();
    }

    // Emit payment notification if order exists
    if (order) {
      emitOrderNotification('payment_received', {
        orderId: order.orderId,
        paymentId,
        amount: order.grandTotal,
        userId: order.user,
        userName: user.fullName || `${user.firstName} ${user.lastName}`
      });

      // Create Shiprocket shipment asynchronously
      shippingService.processShipmentForOrder(order._id).catch(err => {
        console.error('Failed to create Shiprocket shipment:', err.message);
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        requiresRedirect: false,
        razorpayPaymentId: paymentId,
        razorpayOrderId: finalRazorpayOrderId,
        razorpaySignature: expectedSignature,
        order
      }
    });

  } catch (error) {
    console.error('Razorpay S2S payment failed:', error.response?.data || error.message);
    
    let errorMsg = 'Payment processing failed';
    if (error.response?.data) {
      if (typeof error.response.data === 'string') {
        errorMsg = `Gateway error: ${error.response.statusText || 'Not Found'}`;
      } else if (error.response.data.error?.description) {
        errorMsg = error.response.data.error.description;
      }
    } else if (error.message) {
      errorMsg = error.message;
    }
    
    return next(new AppError(errorMsg, 400));
  }
});

// @desc    Handle 3DS callback after S2S card payment
// @route   POST /api/v1/payments/s2s-callback
// @access  Public (called by Razorpay after 3DS)
exports.handleS2SCallback = catchAsync(async (req, res, next) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  const { orderId } = req.query;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  // Find order
  const order = await Order.findOne({ orderId });
  if (!order) {
    return res.redirect(`${frontendUrl}/payment-status?status=failed&error=Order not found`);
  }

  // Verify signature
  if (razorpay_payment_id && razorpay_order_id && razorpay_signature) {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (razorpay_signature === expectedSignature) {
      // Payment verified
      order.paymentStatus = 'paid';
      order.razorpayPaymentId = razorpay_payment_id;
      order.razorpaySignature = razorpay_signature;
      order.status = 'confirmed';
      await order.save();

      // Get user for notification
      const user = await User.findById(order.user);

      // Emit payment notification
      emitOrderNotification('payment_received', {
        orderId: order.orderId,
        paymentId: razorpay_payment_id,
        amount: order.grandTotal,
        userId: order.user,
        userName: user?.fullName || 'Customer'
      });

      // Create Shiprocket shipment asynchronously
      shippingService.processShipmentForOrder(order._id).catch(err => {
        console.error('Failed to create Shiprocket shipment:', err.message);
      });

      return res.redirect(`${frontendUrl}/payment-status?status=success&orderId=${order.orderId}`);
    }
  }

  // Payment failed or signature mismatch
  order.paymentStatus = 'failed';
  await order.save();

  return res.redirect(`${frontendUrl}/payment-status?status=failed&orderId=${order.orderId}`);
});

// Helper functions for webhook handling
async function handlePaymentCaptured(payload) {
  const { payment } = payload;

  // Find order by Razorpay order ID
  const order = await Order.findOne({ razorpayOrderId: payment.entity?.order_id || payment.order_id });

  if (order) {
    // Only process if not already paid
    if (order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.razorpayPaymentId = payment.entity?.id || payment.id;
      order.status = 'confirmed';
      // Capture the actual payment method used (upi, card, netbanking, wallet, etc.)
      if (payment.entity?.method) {
        order.paymentMethod = payment.entity.method;
      }
      await order.save();

      // Get user for notification
      const user = await User.findById(order.user);

      // Emit payment captured notification
      emitOrderNotification('payment_captured', {
        orderId: order.orderId,
        paymentId: payment.entity?.id || payment.id,
        amount: (payment.entity?.amount || payment.amount) / 100,
        userId: order.user,
        userName: user?.fullName || 'Customer'
      });

      // Create Shiprocket shipment if not already created
      if (!order.shiprocketOrderId) {
        shippingService.processShipmentForOrder(order._id).catch(err => {
          console.error('Webhook: Failed to create Shiprocket shipment:', err.message);
        });
      }
    }
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