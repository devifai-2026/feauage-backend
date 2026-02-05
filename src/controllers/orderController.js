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
const PromoCode = require('../models/PromoCode');
const ShippingService = require('../services/shippingService');
const { emitOrderNotification } = require('../sockets/orderSocket');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const razorpay = require('../configs/razorpay');
const { TAX_RATES, SHIPPING } = require('../constants');

// Initialize shipping service for tracking
const shippingService = new ShippingService();

// @desc    Create order from cart
// @route   POST /api/v1/orders
// @access  Private
exports.createOrder = catchAsync(async (req, res, next) => {
  const { shippingAddressId, billingAddressId, paymentMethod, couponCode, promoCode, shippingMethod } = req.body;

  // 1) Validation
  if (!paymentMethod) {
    return next(new AppError('Payment method is required', 400));
  }

  // Check authentication
  if (!req.user || !req.user.id) {
    return next(new AppError('You must be logged in to place an order.', 401));
  }

  // Get user and cart
  const [user, cart] = await Promise.all([
    User.findById(req.user.id),
    Cart.findOne({ user: req.user.id }).populate({
      path: 'items',
      populate: {
        path: 'product',
        populate: {
          path: 'images',
          select: 'url isPrimary displayOrder',
          options: { sort: { isPrimary: -1, displayOrder: 1 }, limit: 1 }
        }
      }
    }).populate('couponApplied')
  ]);

  if (!cart || cart.items.length === 0) {
    return next(new AppError('Your cart is empty', 400));
  }

  // 2) Resolve Addresses
  let shippingAddress;
  if (shippingAddressId) {
    shippingAddress = user.addresses.find(addr => addr._id.toString() === shippingAddressId);
  } else {
    shippingAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0];
  }

  if (!shippingAddress) {
    return next(new AppError('Please select or provide a shipping address', 400));
  }

  let billingAddress = shippingAddress;
  if (billingAddressId) {
    const foundBilling = user.addresses.find(addr => addr._id.toString() === billingAddressId);
    if (foundBilling) billingAddress = foundBilling;
  }

  // 3) Calculate totals and check stock
  if (!cart.cartTotal) await cart.calculateTotals();

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

  // Apply new PromoCode if provided
  let appliedPromoCodeStr = null;
  if (promoCode) {
    const promo = await PromoCode.findOne({ code: promoCode.toUpperCase(), isActive: true });
    if (promo) {
      discountAmount = (cart.cartTotal * promo.discountPercentage) / 100;
      appliedPromoCodeStr = promo.code;
    }
  }

  // Calculate shipping charge (simplified - you might want to integrate with shipping API)
  const shippingCharge = calculateShippingCharge(shippingAddress.pincode, cart.cartTotal);

  // Calculate tax (18% GST for India)
  const taxableAmount = cart.cartTotal - discountAmount;
  const tax = taxableAmount * TAX_RATES.GST;

  // Calculate grand total
  const grandTotal = cart.cartTotal - discountAmount + shippingCharge + tax;

  // PRE-CHECK: Validate Stock Availability before creating order
  // This prevents "Zombie Orders" where order is created but stock deduction fails
  for (const cartItem of cart.items) {
    const product = cartItem.product;
    if (!product) {
      return next(new AppError('One or more products in your cart are no longer available.', 400));
    }

    // Refresh product to get latest stock
    const freshProduct = await Product.findById(product._id);
    if (!freshProduct) {
      return next(new AppError(`Product ${product.name} is no longer available`, 400));
    }

    if (freshProduct.stockQuantity < cartItem.quantity) {
      return next(new AppError(`Insufficient stock for ${freshProduct.name}. Available: ${freshProduct.stockQuantity}`, 400));
    }
  }

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
    status: 'pending',
    promoCode: appliedPromoCodeStr
  });

  // Create order items
  const orderItems = [];
  for (const cartItem of cart.items) {
    const product = cartItem.product;
    if (!product) {
      return next(new AppError('One or more products in your cart are no longer available.', 400));
    }

    const price = product.isOnOffer ? product.offerPrice : product.sellingPrice;

    const orderItem = await OrderItem.create({
      order: order._id,
      product: product._id,
      quantity: cartItem.quantity,
      price,
      sku: product.sku,
      productName: product.name,
      productImage: product.images?.[0]?.url
    });

    orderItems.push(orderItem);

    // Reduce stock
    try {
      await Product.updateStock(
        product._id,
        cartItem.quantity,
        'stock_out',
        req.user.id,
        order._id,
        'Order placed',
        `Order ${order.orderId}`
      );
    } catch (err) {
      return next(new AppError(err.message || 'Error updating stock', 400));
    }
  }

  // Create order addresses
  try {
    const normalizePhone = (phone) => {
      if (!phone) return '';
      const cleaned = phone.toString().replace(/\D/g, '');
      return cleaned.length > 10 ? cleaned.slice(-10) : cleaned;
    };

    const normalizePincode = (pincode) => {
      if (!pincode) return '';
      return pincode.toString().replace(/\D/g, '').slice(0, 6);
    };

    await OrderAddress.create([
      {
        order: order._id,
        type: 'shipping',
        name: shippingAddress.name || user.fullName,
        phone: normalizePhone(shippingAddress.phone || user.phone),
        addressLine1: shippingAddress.address,
        landmark: shippingAddress.landmark,
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: normalizePincode(shippingAddress.pincode),
        country: shippingAddress.country,
        email: user.email
      },
      {
        order: order._id,
        type: 'billing',
        name: billingAddress.name || user.fullName,
        phone: normalizePhone(billingAddress.phone || user.phone),
        addressLine1: billingAddress.address,
        landmark: billingAddress.landmark,
        city: billingAddress.city,
        state: billingAddress.state,
        pincode: normalizePincode(billingAddress.pincode),
        country: billingAddress.country,
        email: user.email
      }
    ]);
  } catch (err) {
    // If address creation fails, we should ideally rollback order but for now return clear error
    return next(new AppError(`Address validation failed: ${err.message}`, 400));
  }

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
      console.error('Razorpay order creation failed:', error);
    }
  } else {
    // For COD, create Shiprocket shipment immediately
    try {
      await shippingService.processShipmentForOrder(order._id);
    } catch (error) {
      console.error('COD Shipment creation failed:', error.message);
      // Don't fail the order creation, but log the error
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
    .populate({
      path: 'items',
      populate: {
        path: 'product',
        select: 'name slug',
        populate: {
          path: 'images',
          select: 'url isPrimary displayOrder',
          options: { sort: { isPrimary: -1, displayOrder: 1 }, limit: 1 }
        }
      }
    })
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
    .populate({
      path: 'items',
      populate: {
        path: 'product',
        select: 'name slug',
        populate: {
          path: 'images',
          select: 'url isPrimary displayOrder',
          options: { sort: { isPrimary: -1, displayOrder: 1 }, limit: 1 }
        }
      }
    })
    .populate('addresses');

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

  // Cancel Shiprocket shipment if exists
  if (order.shiprocketOrderId) {
    try {
      // If we have a shipment ID, use that, otherwise we might need to use order ID (but cancelShipment usually takes shipment ID or AWB)
      // The shippingService.cancelShipment takes shipmentId.
      if (order.shiprocketAWB) {
        await shippingService.cancelShipment(order.shiprocketAWB); // Verify if cancelShipment takes AWB or Shipment ID. Service says shipmentId
      } else if (order.shiprocketShipmentId) {
        await shippingService.cancelShipment(order.shiprocketShipmentId);
      }
    } catch (error) {
      console.error('Shiprocket cancellation failed:', error.message);
    }
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

  // Initialize tracking info with basic order data
  const trackingInfo = {
    orderId: order.orderId,
    status: order.status,
    shippingStatus: order.shippingStatus,
    trackingNumber: order.trackingNumber || order.shiprocketAWB,
    courierName: order.courierName,
    trackingUrl: order.trackingUrl,
    estimatedDelivery: order.estimatedDelivery,
    deliveredAt: order.deliveredAt,
    updates: [],
    shiprocketTracking: null
  };

  // Add basic status updates timeline
  if (order.createdAt) {
    trackingInfo.updates.push({
      status: 'Order Placed',
      date: order.createdAt,
      description: 'Your order has been placed successfully',
      icon: 'shopping_cart'
    });
  }

  if (['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status)) {
    trackingInfo.updates.push({
      status: 'Order Confirmed',
      date: order.updatedAt,
      description: 'Your order has been confirmed and is being processed',
      icon: 'check_circle'
    });
  }

  if (order.shiprocketOrderId) {
    trackingInfo.updates.push({
      status: 'Shipment Created',
      date: order.updatedAt,
      description: 'Your order is ready for shipping',
      icon: 'inventory'
    });
  }

  if (order.pickupScheduled) {
    trackingInfo.updates.push({
      status: 'Pickup Scheduled',
      date: order.updatedAt,
      description: 'Courier pickup has been scheduled',
      icon: 'local_shipping'
    });
  }

  // Fetch real-time tracking from Shiprocket if AWB is available
  if (order.shiprocketAWB) {
    try {
      const shiprocketData = await shippingService.trackShipment(order.shiprocketAWB);

      if (shiprocketData && shiprocketData.tracking_data) {
        trackingInfo.shiprocketTracking = {
          currentStatus: shiprocketData.tracking_data.shipment_status_id,
          currentStatusText: getShiprocketStatusText(shiprocketData.tracking_data.shipment_status),
          edd: shiprocketData.tracking_data.edd,
          etd: shiprocketData.tracking_data.etd,
          activities: (shiprocketData.tracking_data.shipment_track_activities || []).map(activity => ({
            status: activity.activity,
            location: activity.location,
            date: activity.date,
            time: activity['sr-status-label']
          }))
        };

        // Update order status based on Shiprocket tracking
        const shiprocketStatus = shiprocketData.tracking_data.shipment_status;
        const statusMap = {
          '1': { shipping: 'pending', order: order.status },         // AWB Assigned
          '2': { shipping: 'processing', order: 'processing' },      // Pickup Scheduled
          '3': { shipping: 'processing', order: 'processing' },      // Pickup Queued
          '4': { shipping: 'processing', order: 'processing' },      // Pickup Completed
          '5': { shipping: 'shipped', order: 'shipped' },            // In Transit
          '6': { shipping: 'out_for_delivery', order: 'shipped' },   // Out For Delivery
          '7': { shipping: 'delivered', order: 'delivered' },        // Delivered
          '8': { shipping: 'cancelled', order: order.status },       // Cancelled
          '9': { shipping: 'returned', order: 'returned' },          // RTO Initiated
          '10': { shipping: 'returned', order: 'returned' }          // RTO Delivered
        };

        const mappedStatus = statusMap[shiprocketStatus];
        if (mappedStatus && order.shippingStatus !== mappedStatus.shipping) {
          order.shippingStatus = mappedStatus.shipping;
          if (mappedStatus.order !== order.status) {
            order.status = mappedStatus.order;
          }
          if (mappedStatus.shipping === 'delivered') {
            order.deliveredAt = new Date();
          }
          await order.save();

          // Update tracking info with latest data
          trackingInfo.status = order.status;
          trackingInfo.shippingStatus = order.shippingStatus;
          trackingInfo.deliveredAt = order.deliveredAt;
        }

        // Add Shiprocket activities to updates
        if (shiprocketData.tracking_data.shipment_track_activities) {
          shiprocketData.tracking_data.shipment_track_activities.forEach(activity => {
            trackingInfo.updates.push({
              status: activity['sr-status-label'] || activity.activity,
              date: activity.date,
              description: `${activity.activity}${activity.location ? ` at ${activity.location}` : ''}`,
              icon: 'local_shipping',
              fromShiprocket: true
            });
          });
        }
      }
    } catch (error) {
      console.error('Shiprocket tracking fetch error:', error.message);
      // Continue with basic tracking info if Shiprocket fails
    }
  } else {
    // No Shiprocket AWB - add manual status updates
    if (['shipped', 'out_for_delivery', 'delivered'].includes(order.shippingStatus)) {
      trackingInfo.updates.push({
        status: 'Shipped',
        date: order.updatedAt,
        description: order.trackingNumber
          ? `Your order has been shipped. Tracking: ${order.trackingNumber}`
          : 'Your order has been shipped',
        icon: 'local_shipping'
      });
    }

    if (order.shippingStatus === 'out_for_delivery') {
      trackingInfo.updates.push({
        status: 'Out for Delivery',
        date: order.updatedAt,
        description: 'Your order is out for delivery',
        icon: 'directions_bike'
      });
    }
  }

  if (order.shippingStatus === 'delivered' || order.status === 'delivered') {
    trackingInfo.updates.push({
      status: 'Delivered',
      date: order.deliveredAt || order.updatedAt,
      description: 'Your order has been delivered successfully',
      icon: 'check_circle'
    });
  }

  // Sort updates by date (newest first for display, but return oldest first for timeline)
  trackingInfo.updates.sort((a, b) => new Date(a.date) - new Date(b.date));

  res.status(200).json({
    status: 'success',
    data: {
      tracking: trackingInfo
    }
  });
});

// Helper function to get human-readable Shiprocket status
function getShiprocketStatusText(statusCode) {
  const statusTexts = {
    '1': 'AWB Assigned',
    '2': 'Pickup Scheduled',
    '3': 'Pickup Queued',
    '4': 'Pickup Completed',
    '5': 'In Transit',
    '6': 'Out for Delivery',
    '7': 'Delivered',
    '8': 'Cancelled',
    '9': 'RTO Initiated',
    '10': 'RTO Delivered',
    '11': 'Pending',
    '12': 'Lost',
    '13': 'Pickup Error',
    '14': 'RTO Acknowledged',
    '15': 'Pickup Rescheduled',
    '16': 'Cancellation Requested',
    '17': 'Out for Pickup',
    '18': 'In Transit Undelivered',
    '19': 'RTO In Transit',
    '20': 'Misrouted'
  };
  return statusTexts[statusCode] || 'Unknown Status';
}

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

// @desc    Get recent order activity (public)
// @route   GET /api/v1/orders/recent-activity
// @access  Public
exports.getRecentActivity = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ status: { $ne: 'cancelled' } })
    .select('user createdAt')
    .sort('-createdAt')
    .limit(10)
    .populate({
      path: 'user',
      select: 'firstName lastName'
    })
    .populate({
      path: 'items',
      populate: {
        path: 'product',
        select: 'name images'
      }
    })
    .populate({
      path: 'addresses',
      match: { type: 'shipping' },
      select: 'city state'
    });

  const activity = orders.map(order => {
    // Check if items and addresses exist (they are arrays because of virtuals)
    const item = order.items && order.items.length > 0 ? order.items[0] : null;
    const address = order.addresses && order.addresses.length > 0 ? order.addresses[0] : null;

    if (!order.user || !item || !item.product) return null;

    return {
      user: `${order.user.firstName} ${order.user.lastName ? order.user.lastName.charAt(0) + '.' : ''}`,
      city: address ? address.city : 'India',
      product: item.product.name,
      image: item.product.images && item.product.images.length > 0 ? item.product.images[0].url : null,
      time: order.createdAt
    };
  }).filter(Boolean);

  res.status(200).json({
    status: 'success',
    data: activity
  });
});

// Helper function to calculate shipping charge
function calculateShippingCharge(pincode, orderValue) {
  // Simplified shipping calculation
  // In production, integrate with Shiprocket or similar service
  if (orderValue >= 5000) {
    return 0; // Free shipping above ₹5000
  }

  // Handle missing pincode
  if (!pincode || typeof pincode !== 'string') {
    return 100; // Default standard charge
  }

  // Sample pincode-based calculation
  const metroPincodes = ['400001', '110001', '600001', '700001', '500001', '560001'];
  if (metroPincodes.includes(pincode.substring(0, 6))) {
    return 50; // ₹50 for metro cities
  }

  return 100; // ₹100 for other cities
}