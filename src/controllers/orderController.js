const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderAddress = require('../models/OrderAddress');
const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const StockHistory = require('../models/StockHistory');
const Analytics = require('../models/Analytics');
const { emitOrderNotification } = require('../sockets/orderSocket');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const razorpay = require('../configs/razorpay');
const { TAX_RATES, SHIPPING } = require('../constants');

// @desc    Create order from cart
// @route   POST /api/v1/orders
// @access  Private
exports.createOrder = catchAsync(async (req, res, next) => {
  const { shippingAddressId, billingAddressId, paymentMethod, couponCode } = req.body;

  // IMPORTANT: Guest users cannot place orders
  // They must be authenticated (registered and logged in)
  if (!req.user || !req.user.id) {
    return next(new AppError('You must be logged in to place an order. Guest users can add items to cart and wishlist, but must create an account to checkout.', 401));
  }

  // Get user with addresses
  const user = await User.findById(req.user.id).populate('addresses');

  // Get cart with items
  const cart = await Cart.findOne({ user: req.user.id })
    .populate({
      path: 'items',
      populate: {
        path: 'product',
        select: 'name sku sellingPrice offerPrice isOnOffer stockQuantity images'
      }
    })
    .populate('couponApplied');

  if (!cart || cart.items.length === 0) {
    return next(new AppError('Cart is empty', 400));
  }

  // Check stock availability
  const unavailableItems = [];
  for (const item of cart.items) {
    if (item.product.stockQuantity < item.quantity) {
      unavailableItems.push({
        productId: item.product._id,
        productName: item.product.name,
        requested: item.quantity,
        available: item.product.stockQuantity
      });
    }
  }

  if (unavailableItems.length > 0) {
    return res.status(400).json({
      status: 'fail',
      message: 'Some items are out of stock',
      data: {
        unavailableItems
      }
    });
  }

  // Get shipping address
  let shippingAddress;
  if (shippingAddressId) {
    shippingAddress = user.addresses.find(
      addr => addr._id.toString() === shippingAddressId
    );
  } else {
    // Use default address
    shippingAddress = user.addresses.find(addr => addr.isDefault);
  }

  if (!shippingAddress) {
    return next(new AppError('Shipping address not found', 400));
  }

  // Get billing address (use shipping if not provided)
  let billingAddress = shippingAddress;
  if (billingAddressId) {
    billingAddress = user.addresses.find(
      addr => addr._id.toString() === billingAddressId
    ) || shippingAddress;
  }

  // Calculate totals
  await cart.calculateTotals();

  // Apply coupon if provided
  let coupon = null;
  let discountAmount = 0;

  if (couponCode) {
    coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (coupon) {
      const validation = coupon.validateCoupon(cart.cartTotal, req.user.id);
      if (validation.isValid) {
        discountAmount = validation.discountAmount;
        await coupon.applyCoupon();
      }
    }
  } else if (cart.couponApplied) {
    coupon = cart.couponApplied;
    const validation = coupon.validateCoupon(cart.cartTotal, req.user.id);
    if (validation.isValid) {
      discountAmount = validation.discountAmount;
      await coupon.applyCoupon();
    }
  }

  // Calculate shipping charge (simplified - you might want to integrate with shipping API)
  const shippingCharge = calculateShippingCharge(shippingAddress.pincode, cart.cartTotal);

  // Calculate tax (18% GST for India)
  const taxableAmount = cart.cartTotal - discountAmount;
  const tax = taxableAmount * TAX_RATES.GST;

  // Calculate grand total
  const grandTotal = cart.cartTotal - discountAmount + shippingCharge + tax;

  // Create order
  const order = await Order.create({
    user: req.user.id,
    subtotal: cart.cartTotal,
    discount: discountAmount,
    shippingCharge,
    tax,
    grandTotal,
    currency: 'INR',
    paymentMethod,
    paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
    status: 'pending'
  });

  // Create order items
  const orderItems = [];
  for (const cartItem of cart.items) {
    const price = cartItem.product.isOnOffer ? cartItem.product.offerPrice : cartItem.product.sellingPrice;

    const orderItem = await OrderItem.create({
      order: order._id,
      product: cartItem.product._id,
      quantity: cartItem.quantity,
      price,
      sku: cartItem.product.sku,
      productName: cartItem.product.name,
      productImage: cartItem.product.images[0]?.url
    });

    orderItems.push(orderItem);

    // Reduce stock
    await Product.updateStock(
      cartItem.product._id,
      cartItem.quantity,
      'stock_out',
      req.user.id,
      order._id,
      'Order placed',
      `Order ${order.orderId}`
    );
  }

  // Create order addresses
  await OrderAddress.create([
    {
      order: order._id,
      type: 'shipping',
      name: shippingAddress.name || user.fullName,
      phone: shippingAddress.phone || user.phone,
      addressLine1: shippingAddress.addressLine1,
      addressLine2: shippingAddress.addressLine2,
      city: shippingAddress.city,
      state: shippingAddress.state,
      pincode: shippingAddress.pincode,
      country: shippingAddress.country,
      email: user.email
    },
    {
      order: order._id,
      type: 'billing',
      name: billingAddress.name || user.fullName,
      phone: billingAddress.phone || user.phone,
      addressLine1: billingAddress.addressLine1,
      addressLine2: billingAddress.addressLine2,
      city: billingAddress.city,
      state: billingAddress.state,
      pincode: billingAddress.pincode,
      country: billingAddress.country,
      email: user.email
    }
  ]);

  // Clear cart
  await cart.clearCart();

  // Log analytics
  await Analytics.create({
    type: 'purchase',
    entityId: order._id,
    entityType: 'Order',
    user: req.user._id,
    sessionId: req.sessionID || 'anonymous',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: {
      orderId: order.orderId,
      total: grandTotal,
      itemCount: orderItems.length
    }
  });

  // Emit new order notification
  emitOrderNotification('new_order', {
    orderId: order.orderId,
    userId: req.user.id,
    userName: user.fullName,
    total: grandTotal,
    itemsCount: orderItems.length
  });

  // Create Razorpay order for online payments
  let razorpayOrder = null;
  if (paymentMethod !== 'cod') {
    try {
      const options = {
        amount: Math.round(grandTotal * 100), // Amount in paise
        currency: 'INR',
        receipt: order.orderId,
        notes: {
          orderId: order.orderId,
          userId: req.user.id
        }
      };

      razorpayOrder = await razorpay.orders.create(options);

      // Update order with Razorpay order ID
      order.razorpayOrderId = razorpayOrder.id;
      await order.save();
    } catch (error) {
      // Continue without Razorpay order - order is still created
    }
  }

  // Populate order for response
  const populatedOrder = await Order.findById(order._id)
    .populate('items')
    .populate('addresses');

  res.status(201).json({
    status: 'success',
    data: {
      order: populatedOrder,
      razorpayOrder
    }
  });
});

// @desc    Get user orders
// @route   GET /api/v1/orders
// @access  Private
exports.getUserOrders = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    Order.find({ user: req.user.id }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const orders = await features.query
    .populate('items')
    .populate('addresses')
    .sort('-createdAt');

  const total = await Order.countDocuments({
    user: req.user.id,
    ...features.filterQuery
  });

  res.status(200).json({
    status: 'success',
    results: orders.length,
    total,
    data: {
      orders
    }
  });
});

// @desc    Get single order
// @route   GET /api/v1/orders/:id
// @access  Private
exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('items')
    .populate('addresses')
    .populate({
      path: 'items.product',
      select: 'name slug images'
    });

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if order belongs to user or user is admin
  if (order.user.toString() !== req.user.id && req.user.role === 'customer') {
    return next(new AppError('Not authorized to view this order', 403));
  }

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

// @desc    Cancel order
// @route   PATCH /api/v1/orders/:id/cancel
// @access  Private
exports.cancelOrder = catchAsync(async (req, res, next) => {
  const { reason } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if order belongs to user
  if (order.user.toString() !== req.user.id && req.user.role === 'customer') {
    return next(new AppError('Not authorized to cancel this order', 403));
  }

  // Check if order can be cancelled
  if (!['pending', 'confirmed'].includes(order.status)) {
    return next(new AppError('Order cannot be cancelled at this stage', 400));
  }

  // Update order status
  order.status = 'cancelled';
  order.cancellationReason = reason;
  await order.save();

  // Return stock for cancelled items
  const orderItems = await OrderItem.find({ order: order._id });

  for (const item of orderItems) {
    await Product.updateStock(
      item.product,
      item.quantity,
      'stock_in',
      req.user.id,
      order._id,
      'Order cancellation',
      `Order ${order.orderId} cancelled`
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

// @desc    Track order
// @route   GET /api/v1/orders/:id/track
// @access  Private
exports.trackOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if order belongs to user
  if (order.user.toString() !== req.user.id && req.user.role === 'customer') {
    return next(new AppError('Not authorized to track this order', 403));
  }

  // Get tracking information (simplified - integrate with Shiprocket API)
  const trackingInfo = {
    orderId: order.orderId,
    status: order.status,
    shippingStatus: order.shippingStatus,
    trackingNumber: order.trackingNumber,
    estimatedDelivery: order.estimatedDelivery,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    updates: []
  };

  // Add status updates
  if (order.createdAt) {
    trackingInfo.updates.push({
      status: 'Order Placed',
      date: order.createdAt,
      description: 'Your order has been placed successfully'
    });
  }

  if (order.status === 'confirmed') {
    trackingInfo.updates.push({
      status: 'Order Confirmed',
      date: order.updatedAt,
      description: 'Your order has been confirmed'
    });
  }

  if (order.shippingStatus === 'shipped') {
    trackingInfo.updates.push({
      status: 'Shipped',
      date: order.updatedAt,
      description: `Your order has been shipped. Tracking number: ${order.trackingNumber}`
    });
  }

  if (order.shippingStatus === 'delivered') {
    trackingInfo.updates.push({
      status: 'Delivered',
      date: order.deliveredAt,
      description: 'Your order has been delivered'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      tracking: trackingInfo
    }
  });
});

// @desc    Get order invoice
// @route   GET /api/v1/orders/:id/invoice
// @access  Private
exports.getOrderInvoice = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('items')
    .populate('addresses')
    .populate('user', 'firstName lastName email phone');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if order belongs to user
  if (order.user._id.toString() !== req.user.id && req.user.role === 'customer') {
    return next(new AppError('Not authorized to view this invoice', 403));
  }

  // Generate invoice URL (simplified - implement actual PDF generation)
  const invoiceUrl = `${req.protocol}://${req.get('host')}/api/v1/invoices/${order.invoiceNumber}.pdf`;

  // Update order with invoice URL if not already set
  if (!order.invoiceUrl) {
    order.invoiceUrl = invoiceUrl;
    order.invoiceGeneratedAt = new Date();
    await order.save();
  }

  res.status(200).json({
    status: 'success',
    data: {
      invoiceUrl: order.invoiceUrl || invoiceUrl
    }
  });
});

// @desc    Create Razorpay order for payment
// @route   POST /api/v1/orders/:id/create-payment
// @access  Private
exports.createPaymentOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if order belongs to user
  if (order.user.toString() !== req.user.id) {
    return next(new AppError('Not authorized to pay for this order', 403));
  }

  // Check if order is already paid
  if (order.paymentStatus === 'paid') {
    return next(new AppError('Order is already paid', 400));
  }

  // Create Razorpay order
  try {
    const options = {
      amount: Math.round(order.grandTotal * 100), // Amount in paise
      currency: 'INR',
      receipt: order.orderId,
      notes: {
        orderId: order.orderId,
        userId: req.user.id
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Update order with Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.status(200).json({
      status: 'success',
      data: {
        razorpayOrder,
        order
      }
    });
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    return next(new AppError('Payment gateway error', 500));
  }
});

// Helper function to calculate shipping charge
function calculateShippingCharge(pincode, orderValue) {
  // Simplified shipping calculation
  // In production, integrate with Shiprocket or similar service
  if (orderValue >= 5000) {
    return 0; // Free shipping above ₹5000
  }

  // Sample pincode-based calculation
  const metroPincodes = ['400001', '110001', '600001', '700001', '500001', '560001'];
  if (metroPincodes.includes(pincode.substring(0, 6))) {
    return 50; // ₹50 for metro cities
  }

  return 100; // ₹100 for other cities
}