const Order = require('../../models/Order');
const OrderItem = require('../../models/OrderItem');
const OrderAddress = require('../../models/OrderAddress');
const User = require('../../models/User');
const Product = require('../../models/Product');
const AdminActivity = require('../../models/AdminActivity');
const ShippingService = require('../../services/shippingService');
const { emitOrderNotification } = require('../../sockets/orderSocket');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');
const PDFDocument = require('pdfkit');

// Initialize shipping service
const shippingService = new ShippingService();

// @desc    Get all orders (admin view)
// @route   GET /api/v1/admin/orders
// @access  Private/Admin

exports.getAllOrders = catchAsync(async (req, res, next) => {
  console.log("=== getAllOrders Debug ===");
  console.log("Query parameters:", req.query);
  
  // Create base query
  let baseQuery = Order.find();
  
  // Apply APIFeatures
  const features = new APIFeatures(baseQuery, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  console.log("Final filter query:", features.filterQuery);
  
  // Execute query with population
  const orders = await features.query
    .populate({
      path: 'user',
      select: 'firstName lastName email phone',
    })
    .populate({
      path: 'items',
      populate: {
        path: 'product',
        select: 'name sku images price',
        populate: { path: 'images' }
      }
    })
    .populate('addresses');
  
  console.log("Found orders:", orders.length);
  
  // Get total count
  const total = await Order.countDocuments(features.filterQuery);
  console.log("Total count with filter:", total);
  
  // Debug: Also check total without any filters
  const totalAll = await Order.countDocuments({});
  console.log("Total orders in DB:", totalAll);
  
  // Debug: Check if we can find the order directly
  const testOrder = await Order.findById("694197052cf79abed2bbfeb9");
  console.log("Test order found:", testOrder ? "Yes" : "No");
  
  res.status(200).json({
    status: 'success',
    results: orders.length,
    total,
    data: {
      orders
    }
  });
});

// @desc    Get order details (admin view)
// @route   GET /api/v1/admin/orders/:id
// @access  Private/Admin
exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'firstName lastName email phone')
    .populate({
      path: 'items',
      populate: {
        path: 'product',
        select: 'name sku images',
        populate: { path: 'images' }
      }
    })
    .populate('addresses');
  
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

// @desc    Update order status (admin)
// @route   PATCH /api/v1/admin/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status, cancellationReason, adminNotes } = req.body;
  
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  const previousStatus = order.status;
  
  // Update order
  const updateData = {};
  if (status) updateData.status = status;
  if (cancellationReason) updateData.cancellationReason = cancellationReason;
  if (adminNotes) updateData.adminNotes = adminNotes;
  
  const updatedOrder = await Order.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('user', 'firstName lastName email');
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'Order',
    entityId: order._id,
    metadata: {
      previousStatus,
      newStatus: status,
      orderId: order.orderId
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // If status changed to shipped or delivered, emit notification
  if (status && ['shipped', 'delivered'].includes(status)) {
    emitOrderNotification('order_status_updated', {
      orderId: order.orderId,
      status,
      userId: order.user._id,
      userName: order.user.fullName
    });
  }
  
  // If order is cancelled, return stock for items
  if (status === 'cancelled' && previousStatus !== 'cancelled') {
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
        `Order ${order.orderId} cancelled by admin`
      );
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      order: updatedOrder
    }
  });
});

// @desc    Update shipping status (admin)
// @route   PATCH /api/v1/admin/orders/:id/shipping-status
// @access  Private/Admin
exports.updateShippingStatus = catchAsync(async (req, res, next) => {
  const { shippingStatus, trackingNumber, trackingUrl, shiprocketAWB, estimatedDelivery } = req.body;
  
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  const previousShippingStatus = order.shippingStatus;
  
  const updateData = { shippingStatus };
  if (trackingNumber) updateData.trackingNumber = trackingNumber;
  if (trackingUrl) updateData.trackingUrl = trackingUrl;
  if (shiprocketAWB) updateData.shiprocketAWB = shiprocketAWB;
  if (estimatedDelivery) updateData.estimatedDelivery = estimatedDelivery;
  
  if (shippingStatus === 'delivered') {
    updateData.deliveredAt = Date.now();
    updateData.status = 'delivered';
  }
  
  const updatedOrder = await Order.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('user', 'firstName lastName email');
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'Order',
    entityId: order._id,
    metadata: {
      previousShippingStatus,
      newShippingStatus: shippingStatus,
      trackingNumber,
      orderId: order.orderId
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Emit shipping update notification
  emitOrderNotification('shipping_status_updated', {
    orderId: order.orderId,
    shippingStatus,
    trackingNumber,
    userId: order.user._id,
    userName: order.user.fullName
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      order: updatedOrder
    }
  });
});

// @desc    Update payment status (admin)
// @route   PATCH /api/v1/admin/orders/:id/payment-status
// @access  Private/Admin
exports.updatePaymentStatus = catchAsync(async (req, res, next) => {
  const { paymentStatus } = req.body;
  
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  const previousPaymentStatus = order.paymentStatus;
  
  const updatedOrder = await Order.findByIdAndUpdate(
    req.params.id,
    { paymentStatus },
    { new: true, runValidators: true }
  );
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'Order',
    entityId: order._id,
    metadata: {
      previousPaymentStatus,
      newPaymentStatus: paymentStatus,
      orderId: order.orderId
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      order: updatedOrder
    }
  });
});

// @desc    Get order statistics (admin)
// @route   GET /api/v1/admin/orders/statistics
// @access  Private/Admin
exports.getOrderStatistics = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  const stats = await Order.getStatistics(startDate, endDate);
  
  // Get daily orders for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const dailyOrders = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 },
        revenue: { $sum: '$grandTotal' },
        averageOrderValue: { $avg: '$grandTotal' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Get top selling products
  const topProducts = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        status: 'delivered'
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalSold: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $project: {
        productId: '$_id',
        productName: '$product.name',
        productSku: '$product.sku',
        totalSold: 1,
        totalRevenue: 1,
        _id: 0
      }
    }
  ]);
  
  // Get revenue by payment method
  const revenueByPaymentMethod = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        status: 'delivered'
      }
    },
    {
      $group: {
        _id: '$paymentMethod',
        totalRevenue: { $sum: '$grandTotal' },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
  
  res.status(200).json({
    status: 'success',
    data: {
      statistics: stats,
      dailyOrders,
      topProducts,
      revenueByPaymentMethod
    }
  });
});

// @desc    Create manual order (admin)
// @route   POST /api/v1/admin/orders/manual
// @access  Private/Admin
exports.createManualOrder = catchAsync(async (req, res, next) => {
  const { userId, items, shippingAddress, billingAddress, paymentMethod, notes } = req.body;
  
  // Validate user exists
  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  // Calculate totals
  let subtotal = 0;
  const orderItems = [];
  
  for (const item of items) {
    const product = await Product.findById(item.product).populate('images');
    if (!product) {
      return next(new AppError(`Product ${item.product} not found`, 404));
    }
    
    if (product.stockQuantity < item.quantity) {
      return next(new AppError(`Insufficient stock for ${product.name}`, 400));
    }
    
    const price = product.isOnOffer ? product.offerPrice : product.sellingPrice;
    const itemTotal = price * item.quantity;
    subtotal += itemTotal;
    
    orderItems.push({
      product: product._id,
      name: product.name,
      sku: product.sku,
      quantity: item.quantity,
      price,
      total: itemTotal
    });
  }
  
  // Calculate shipping charge
  const shippingCharge = calculateShippingCharge(shippingAddress.pincode, subtotal);
  
  // Calculate tax (18% GST)
  const tax = subtotal * 0.18;
  
  // Calculate grand total
  const grandTotal = subtotal + shippingCharge + tax;
  
  // Create order
  const order = await Order.create({
    user: userId,
    subtotal,
    shippingCharge,
    tax,
    grandTotal,
    currency: 'INR',
    paymentMethod,
    paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
    status: 'confirmed',
    adminNotes: notes,
    createdBy: req.user.id
  });
  
  // Create order items
  for (const item of orderItems) {
    await OrderItem.create({
      order: order._id,
      product: item.product,
      quantity: item.quantity,
      price: item.price,
      sku: item.sku,
      productName: item.name,
      productImage: product.images?.[0]?.url
    });
    
    // Reduce stock
    await Product.updateStock(
      item.product,
      item.quantity,
      'stock_out',
      req.user.id,
      order._id,
      'Manual order creation',
      `Manual order ${order.orderId}`
    );
  }
  
  // Create order addresses
  await OrderAddress.create([
    {
      order: order._id,
      type: 'shipping',
      ...shippingAddress
    },
    {
      order: order._id,
      type: 'billing',
      ...(billingAddress || shippingAddress)
    }
  ]);
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'create',
    entityType: 'Order',
    entityId: order._id,
    newState: order.toObject(),
    metadata: {
      orderId: order.orderId,
      userId,
      itemCount: items.length,
      total: grandTotal
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Emit new order notification
  emitOrderNotification('new_order', {
    orderId: order.orderId,
    userId,
    userName: user.fullName,
    total: grandTotal,
    itemsCount: items.length
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      order
    }
  });
});

// @desc    Export orders to CSV/Excel
// @route   GET /api/v1/admin/orders/export
// @access  Private/Admin
exports.exportOrders = catchAsync(async (req, res, next) => {
  const { startDate, endDate, status, paymentMethod } = req.query;
  
  const filter = {};
  
  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  if (status) filter.status = status;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  
  const orders = await Order.find(filter)
    .populate('user', 'firstName lastName email phone')
    .populate('items')
    .sort('-createdAt');
  
  // Format data for export
  const exportData = orders.map(order => ({
    'Order ID': order.orderId,
    'Date': order.createdAt.toLocaleDateString(),
    'Customer': `${order.user.firstName} ${order.user.lastName}`,
    'Email': order.user.email,
    'Phone': order.user.phone,
    'Status': order.status,
    'Payment Status': order.paymentStatus,
    'Payment Method': order.paymentMethod,
    'Subtotal': order.subtotal,
    'Shipping': order.shippingCharge,
    'Tax': order.tax,
    'Total': order.grandTotal,
    'Items': order.items.length,
    'Shipping Status': order.shippingStatus,
    'Tracking Number': order.trackingNumber || ''
  }));
  
  res.status(200).json({
    status: 'success',
    data: {
      orders: exportData,
      count: orders.length
    }
  });
});

// @desc    Bulk update orders status (admin)
// @route   POST /api/v1/admin/orders/bulk-update
// @access  Private/Admin
exports.bulkUpdateOrders = catchAsync(async (req, res, next) => {
  const { orderIds, status, adminNotes } = req.body;
  
  if (!orderIds || !orderIds.length) {
    return next(new AppError('No orders selected', 400));
  }
  
  if (!status) {
    return next(new AppError('Status is required', 400));
  }
  
  const updatePromises = orderIds.map(async (orderId) => {
    const order = await Order.findById(orderId);
    if (!order) return null;
    
    const previousStatus = order.status;
    
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { 
        status,
        adminNotes: adminNotes || order.adminNotes 
      },
      { new: true }
    );
    
    // Log admin activity
    await AdminActivity.logActivity({
      adminUser: req.user.id,
      action: 'bulk_update',
      entityType: 'Order',
      entityId: orderId,
      metadata: {
        previousStatus,
        newStatus: status,
        orderId: order.orderId
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    // If order is cancelled, return stock
    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      const orderItems = await OrderItem.find({ order: orderId });
      
      for (const item of orderItems) {
        await Product.updateStock(
          item.product,
          item.quantity,
          'stock_in',
          req.user.id,
          orderId,
          'Bulk order cancellation',
          `Order ${order.orderId} cancelled in bulk update`
        );
      }
    }
    
    return updatedOrder;
  });
  
  const updatedOrders = await Promise.all(updatePromises);
  const successfulUpdates = updatedOrders.filter(order => order !== null);
  
  // Emit notifications for status changes
  if (['shipped', 'delivered'].includes(status)) {
    for (const order of successfulUpdates) {
      const populatedOrder = await Order.findById(order._id)
        .populate('user', 'firstName lastName email');
      
      emitOrderNotification('bulk_order_status_updated', {
        orderId: populatedOrder.orderId,
        status,
        userId: populatedOrder.user._id,
        userName: populatedOrder.user.fullName
      });
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      updatedCount: successfulUpdates.length,
      orders: successfulUpdates
    }
  });
});

// @desc    Get order timeline/history
// @route   GET /api/v1/admin/orders/:id/timeline
// @access  Private/Admin
exports.getOrderTimeline = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  // Get order status changes from AdminActivity
  const timeline = await AdminActivity.find({
    entityType: 'Order',
    entityId: order._id,
    $or: [
      { 'metadata.previousStatus': { $exists: true } },
      { 'metadata.previousShippingStatus': { $exists: true } },
      { 'metadata.previousPaymentStatus': { $exists: true } }
    ]
  })
  .sort('-createdAt')
  .populate('adminUser', 'firstName lastName email')
  .limit(20);
  
  // Format timeline entries
  const formattedTimeline = timeline.map(activity => {
    const entry = {
      id: activity._id,
      date: activity.createdAt,
      admin: activity.adminUser ? `${activity.adminUser.firstName} ${activity.adminUser.lastName}` : 'System',
      action: activity.action,
      description: '',
      type: 'admin_action'
    };
    
    const metadata = activity.metadata || {};
    
    if (metadata.previousStatus && metadata.newStatus) {
      entry.description = `Order status changed from ${metadata.previousStatus} to ${metadata.newStatus}`;
      entry.type = 'status_change';
    } else if (metadata.previousShippingStatus && metadata.newShippingStatus) {
      entry.description = `Shipping status changed from ${metadata.previousShippingStatus} to ${metadata.newShippingStatus}`;
      entry.type = 'shipping_update';
    } else if (metadata.previousPaymentStatus && metadata.newPaymentStatus) {
      entry.description = `Payment status changed from ${metadata.previousPaymentStatus} to ${metadata.newPaymentStatus}`;
      entry.type = 'payment_update';
    } else if (activity.action === 'create') {
      entry.description = 'Order created manually';
      entry.type = 'order_created';
    }
    
    return entry;
  });
  
  // Add system events (order created, payment received, etc.)
  const systemEvents = [];
  
  // Order creation event
  systemEvents.push({
    id: 'system_creation',
    date: order.createdAt,
    admin: 'System',
    action: 'create',
    description: 'Order created',
    type: 'order_created'
  });
  
  // Payment events
  if (order.paymentStatus === 'paid' && order.paidAt) {
    systemEvents.push({
      id: 'system_payment',
      date: order.paidAt,
      admin: 'System',
      action: 'payment',
      description: 'Payment received',
      type: 'payment_received'
    });
  }
  
  // Shipping events
  if (order.shippedAt) {
    systemEvents.push({
      id: 'system_shipped',
      date: order.shippedAt,
      admin: 'System',
      action: 'shipping',
      description: 'Order shipped',
      type: 'order_shipped'
    });
  }
  
  if (order.deliveredAt) {
    systemEvents.push({
      id: 'system_delivered',
      date: order.deliveredAt,
      admin: 'System',
      action: 'delivery',
      description: 'Order delivered',
      type: 'order_delivered'
    });
  }
  
  // Combine and sort all timeline entries
  const fullTimeline = [...formattedTimeline, ...systemEvents]
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  res.status(200).json({
    status: 'success',
    data: {
      timeline: fullTimeline
    }
  });
});

// @desc    Search orders
// @route   GET /api/v1/admin/orders/search
// @access  Private/Admin
exports.searchOrders = catchAsync(async (req, res, next) => {
  const { q: searchTerm } = req.query;
  
  if (!searchTerm) {
    return next(new AppError('Search term is required', 400));
  }
  
  // Search in multiple fields
  const searchQuery = {
    $or: [
      { orderId: { $regex: searchTerm, $options: 'i' } },
      { trackingNumber: { $regex: searchTerm, $options: 'i' } },
      { 'user.firstName': { $regex: searchTerm, $options: 'i' } },
      { 'user.lastName': { $regex: searchTerm, $options: 'i' } },
      { 'user.email': { $regex: searchTerm, $options: 'i' } },
      { 'user.phone': { $regex: searchTerm, $options: 'i' } }
    ]
  };
  
  const orders = await Order.find(searchQuery)
    .populate('user', 'firstName lastName email phone')
    .populate('items')
    .sort('-createdAt')
    .limit(20);
  
  res.status(200).json({
    status: 'success',
    data: {
      orders,
      count: orders.length
    }
  });
});

// @desc    Get recent order activities
// @route   GET /api/v1/admin/orders/recent-activities
// @access  Private/Admin
exports.getRecentActivities = catchAsync(async (req, res, next) => {
  // Get the latest 5 orders
  const recentOrders = await Order.find()
    .sort('-createdAt')
    .populate('user', 'firstName lastName email')
    .populate({
      path: 'items',
      populate: {
        path: 'product',
        select: 'name sku images'
      }
    })
    .limit(5);
  
  // Format the activities
  const formattedActivities = recentOrders.map(order => {
    const user = order.user;
    const itemsCount = order.items ? order.items.length : 0;
    
    // Determine activity description based on order status
    let description = '';
    let action = '';
    let color = 'bg-blue-500'; // Default color
    
    switch (order.status) {
      case 'pending':
        description = 'New order placed';
        action = 'created';
        color = 'bg-yellow-500';
        break;
      case 'processing':
        description = 'Order is being processed';
        action = 'processing';
        color = 'bg-blue-500';
        break;
      case 'shipped':
        description = 'Order has been shipped';
        action = 'shipped';
        color = 'bg-purple-500';
        break;
      case 'delivered':
        description = 'Order has been delivered';
        action = 'delivered';
        color = 'bg-green-500';
        break;
      case 'cancelled':
        description = 'Order has been cancelled';
        action = 'cancelled';
        color = 'bg-red-500';
        break;
      default:
        description = 'Order updated';
        action = 'updated';
        color = 'bg-gray-500';
    }
    
    // Calculate time ago
    const timeAgo = getTimeAgo(order.createdAt);
    
    return {
      id: order._id,
      orderId: order.orderId || `ORD${order._id.toString().slice(-6)}`,
      action,
      description,
      customer: user ? `${user.firstName} ${user.lastName}` : 'Customer',
      email: user?.email || 'N/A',
      time: order.createdAt,
      timeAgo,
      amount: order.grandTotal || 0,
      status: order.status,
      itemsCount,
      color,
      paymentMethod: order.paymentMethod || 'N/A',
      paymentStatus: order.paymentStatus || 'pending',
      trackingNumber: order.trackingNumber || 'Not available'
    };
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      activities: formattedActivities
    }
  });
});

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const orderDate = new Date(date);
  const diffMs = now - orderDate;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else {
    return orderDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: orderDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

// @desc    Generate invoice PDF
// @route   GET /api/v1/admin/orders/:id/invoice
// @access  Private/Admin
exports.generateInvoice = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'firstName lastName email phone')
    .populate('items')
    .populate('addresses');
  
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  // Create a PDF document
  const doc = new PDFDocument({ margin: 50 });

  // Buffers to store PDF data
  const buffers = [];
  doc.on('data', (chunk) => buffers.push(chunk));
  doc.on('end', () => {
    const pdfBuffer = Buffer.concat(buffers);
    
    // Set response headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${order.orderId}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    // Send the PDF buffer
    res.status(200).send(pdfBuffer);
  });

  // Header - Company Logo/Name
  doc.fillColor('#444444')
     .fontSize(20)
     .text('FEAUAGE', 50, 50);
  
  doc.fontSize(10)
     .text('Premium Jewelry Store', 50, 75)
     .text('123 Luxury Lane, Jewelry District', 50, 90)
     .text('Mumbai, Maharashtra, 400001', 50, 105)
     .moveDown();

  // Invoice Title
  doc.fillColor('#000000')
     .fontSize(20)
     .text('INVOICE', 50, 140, { align: 'right' });

  // Invoice Info
  doc.fontSize(10)
     .text(`Invoice Number: ${order.orderId}`, 50, 170, { align: 'right' })
     .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, 185, { align: 'right' })
     .text(`Payment Status: ${order.paymentStatus.toUpperCase()}`, 50, 200, { align: 'right' })
     .moveDown();

  // Billing & Shipping Info
  const billingAddr = order.addresses.find(addr => addr.type === 'billing') || order.addresses[0];
  const shippingAddr = order.addresses.find(addr => addr.type === 'shipping') || order.addresses[0];

  doc.fontSize(12).text('Bill To:', 50, 230);
  doc.fontSize(10)
     .text(`${order.user.firstName} ${order.user.lastName}`, 50, 245)
     .text(billingAddr.addressLine1, 50, 260)
     .text(`${billingAddr.city}, ${billingAddr.state} ${billingAddr.pincode}`, 50, 275)
     .text(order.user.email, 50, 290)
     .text(order.user.phone, 50, 305);

  doc.fontSize(12).text('Ship To:', 300, 230);
  doc.fontSize(10)
     .text(`${order.user.firstName} ${order.user.lastName}`, 300, 245)
     .text(shippingAddr.addressLine1, 300, 260)
     .text(`${shippingAddr.city}, ${shippingAddr.state} ${shippingAddr.pincode}`, 300, 275)
     .moveDown();

  // Table Header
  const tableTop = 350;
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Item', 50, tableTop);
  doc.text('SKU', 180, tableTop);
  doc.text('Price', 280, tableTop, { width: 90, align: 'right' });
  doc.text('Qty', 370, tableTop, { width: 50, align: 'right' });
  doc.text('Total', 470, tableTop, { width: 90, align: 'right' });

  doc.moveTo(50, tableTop + 15).lineTo(560, tableTop + 15).stroke();

  // Table Content
  let y = tableTop + 25;
  doc.font('Helvetica');
  
  order.items.forEach((item) => {
    const itemName = item.productName || (item.product ? item.product.name : 'Product');
    const price = item.price;
    const qty = item.quantity;
    const total = price * qty;

    doc.text(itemName, 50, y, { width: 120 });
    doc.text(item.sku || 'N/A', 180, y);
    doc.text(`INR ${price.toFixed(2)}`, 280, y, { width: 90, align: 'right' });
    doc.text(qty.toString(), 370, y, { width: 50, align: 'right' });
    doc.text(`INR ${total.toFixed(2)}`, 470, y, { width: 90, align: 'right' });
    
    y += 20;
  });

  // Totals
  doc.moveTo(350, y + 10).lineTo(560, y + 10).stroke();
  y += 20;

  doc.text('Subtotal:', 350, y, { width: 100, align: 'right' });
  doc.text(`INR ${order.subtotal.toFixed(2)}`, 470, y, { width: 90, align: 'right' });
  
  y += 15;
  if (order.discount > 0) {
    doc.text('Discount:', 350, y, { width: 100, align: 'right' });
    doc.text(`-INR ${order.discount.toFixed(2)}`, 470, y, { width: 90, align: 'right' });
    y += 15;
  }

  doc.text('Shipping:', 350, y, { width: 100, align: 'right' });
  doc.text(`INR ${order.shippingCharge.toFixed(2)}`, 470, y, { width: 90, align: 'right' });
  
  y += 15;
  doc.text('Tax (GST):', 350, y, { width: 100, align: 'right' });
  doc.text(`INR ${order.tax.toFixed(2)}`, 470, y, { width: 90, align: 'right' });
  
  y += 20;
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('Grand Total:', 350, y, { width: 100, align: 'right' });
  doc.text(`INR ${order.grandTotal.toFixed(2)}`, 470, y, { width: 90, align: 'right' });

  // Footer
  doc.fontSize(10).font('Helvetica')
     .text('Thank you for shopping with FEAUAGE!', 50, 700, { align: 'center', width: 500 });

  // Finalize PDF file
  doc.end();
});

// @desc    Send invoice via email
// @route   POST /api/v1/admin/orders/:id/send-invoice
// @access  Private/Admin
exports.sendInvoiceEmail = catchAsync(async (req, res, next) => {
  const { email, subject, message } = req.body;
  
  const order = await Order.findById(req.params.id)
    .populate('user', 'firstName lastName email');
  
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  
  const targetEmail = email || order.user.email;
  
  // In production, implement email sending logic
  // await sendEmail({
  //   to: targetEmail,
  //   subject: subject || `Invoice for Order ${order.orderId}`,
  //   html: generateInvoiceEmailHTML(order, message)
  // });
  
  // Log email sending activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'send_email',
    entityType: 'Order',
    entityId: order._id,
    metadata: {
      orderId: order.orderId,
      emailSentTo: targetEmail,
      emailSubject: subject
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(200).json({
    status: 'success',
    message: 'Invoice email sent successfully',
    data: {
      email: targetEmail,
      orderId: order.orderId
    }
  });
});

// @desc    Get orders by status count
// @route   GET /api/v1/admin/orders/status-count
// @access  Private/Admin
exports.getOrdersByStatusCount = catchAsync(async (req, res, next) => {
  const counts = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { 
          $sum: { 
            $cond: [{ $eq: ['$status', 'delivered'] }, '$grandTotal', 0] 
          }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  // Format counts
  const formattedCounts = {};
  counts.forEach(item => {
    formattedCounts[item._id] = {
      count: item.count,
      revenue: item.totalRevenue
    };
  });
  
  // Ensure all statuses are present
  const allStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
  const result = {};
  
  allStatuses.forEach(status => {
    result[status] = formattedCounts[status] || { count: 0, revenue: 0 };
  });
  
  // Get total counts
  const totalOrders = await Order.countDocuments();
  const totalRevenue = await Order.aggregate([
    { $match: { status: 'delivered' } },
    { $group: { _id: null, total: { $sum: '$grandTotal' } } }
  ]);
  
  result.total = {
    orders: totalOrders,
    revenue: totalRevenue[0]?.total || 0
  };
  
  res.status(200).json({
    status: 'success',
    data: {
      counts: result
    }
  });
});

// Helper function
function calculateShippingCharge(pincode, orderValue) {
  if (orderValue >= 5000) {
    return 0;
  }

  const metroPincodes = ['400001', '110001', '600001', '700001', '500001', '560001'];
  if (metroPincodes.includes(pincode.substring(0, 6))) {
    return 50;
  }

  return 100;
}

// =====================================================
// SHIPROCKET INTEGRATION ENDPOINTS
// =====================================================

// @desc    Create Shiprocket shipment for order
// @route   POST /api/v1/admin/orders/:id/create-shipment
// @access  Private/Admin
exports.createShipment = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'firstName lastName email phone')
    .populate('addresses');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if shipment already exists
  if (order.shiprocketOrderId) {
    return next(new AppError('Shipment already created for this order', 400));
  }

  // Get order items
  const orderItems = await OrderItem.find({ order: order._id });

  if (!orderItems.length) {
    return next(new AppError('No items found in order', 400));
  }

  // Get shipping address
  const shippingAddress = order.addresses.find(addr => addr.type === 'shipping');

  if (!shippingAddress) {
    return next(new AppError('Shipping address not found', 400));
  }

  // Prepare order data for Shiprocket
  const shipmentData = ShippingService.createOrderData(order, orderItems, shippingAddress);

  // Override with any custom data from request body
  if (req.body.length) shipmentData.length = req.body.length;
  if (req.body.breadth) shipmentData.breadth = req.body.breadth;
  if (req.body.height) shipmentData.height = req.body.height;
  if (req.body.weight) shipmentData.weight = req.body.weight;

  try {
    // Create shipment in Shiprocket
    const shiprocketResponse = await shippingService.createShipment(shipmentData);

    // Update order with Shiprocket details
    order.shiprocketOrderId = shiprocketResponse.order_id;
    order.shiprocketShipmentId = shiprocketResponse.shipment_id;
    order.shippingStatus = 'confirmed';
    order.status = 'processing';
    await order.save();

    // Log admin activity
    await AdminActivity.logActivity({
      adminUser: req.user.id,
      action: 'create_shipment',
      entityType: 'Order',
      entityId: order._id,
      metadata: {
        orderId: order.orderId,
        shiprocketOrderId: shiprocketResponse.order_id,
        shiprocketShipmentId: shiprocketResponse.shipment_id
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      status: 'success',
      message: 'Shipment created successfully',
      data: {
        shiprocketOrderId: shiprocketResponse.order_id,
        shiprocketShipmentId: shiprocketResponse.shipment_id,
        order
      }
    });
  } catch (error) {
    console.error('Shiprocket API error:', error.response?.data || error.message);
    return next(new AppError(
      error.response?.data?.message || 'Failed to create shipment in Shiprocket',
      500
    ));
  }
});

// @desc    Get available couriers for order
// @route   GET /api/v1/admin/orders/:id/available-couriers
// @access  Private/Admin
exports.getAvailableCouriers = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('addresses');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const shippingAddress = order.addresses.find(addr => addr.type === 'shipping');

  if (!shippingAddress) {
    return next(new AppError('Shipping address not found', 400));
  }

  // Get weight from request or use default
  const weight = req.query.weight || 0.5;

  // Pickup pincode (your warehouse/store pincode)
  const pickupPincode = process.env.PICKUP_PINCODE || '400001';

  try {
    const couriers = await shippingService.getAvailableCouriers(
      pickupPincode,
      shippingAddress.pincode,
      weight
    );

    res.status(200).json({
      status: 'success',
      data: {
        couriers: couriers.data?.available_courier_companies || [],
        recommendedCourierId: couriers.data?.recommended_courier_company_id
      }
    });
  } catch (error) {
    console.error('Shiprocket courier check error:', error.response?.data || error.message);
    return next(new AppError(
      error.response?.data?.message || 'Failed to fetch available couriers',
      500
    ));
  }
});

// @desc    Generate AWB for shipment
// @route   POST /api/v1/admin/orders/:id/generate-awb
// @access  Private/Admin
exports.generateAWB = catchAsync(async (req, res, next) => {
  const { courierId } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (!order.shiprocketShipmentId) {
    return next(new AppError('Shipment not created yet. Create shipment first.', 400));
  }

  if (order.shiprocketAWB) {
    return next(new AppError('AWB already generated for this order', 400));
  }

  if (!courierId) {
    return next(new AppError('Courier ID is required', 400));
  }

  try {
    const awbResponse = await shippingService.generateAWB(order.shiprocketShipmentId, courierId);

    // Update order with AWB details
    order.shiprocketAWB = awbResponse.response?.data?.awb_code;
    order.trackingNumber = awbResponse.response?.data?.awb_code;
    order.courierName = awbResponse.response?.data?.courier_name;
    order.shippingStatus = 'processing';
    await order.save();

    // Log admin activity
    await AdminActivity.logActivity({
      adminUser: req.user.id,
      action: 'generate_awb',
      entityType: 'Order',
      entityId: order._id,
      metadata: {
        orderId: order.orderId,
        awb: awbResponse.response?.data?.awb_code,
        courier: awbResponse.response?.data?.courier_name
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      status: 'success',
      message: 'AWB generated successfully',
      data: {
        awb: awbResponse.response?.data?.awb_code,
        courierName: awbResponse.response?.data?.courier_name,
        order
      }
    });
  } catch (error) {
    console.error('Shiprocket AWB error:', error.response?.data || error.message);
    return next(new AppError(
      error.response?.data?.message || 'Failed to generate AWB',
      500
    ));
  }
});

// @desc    Schedule pickup for shipment
// @route   POST /api/v1/admin/orders/:id/schedule-pickup
// @access  Private/Admin
exports.schedulePickup = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (!order.shiprocketShipmentId) {
    return next(new AppError('Shipment not created yet', 400));
  }

  if (!order.shiprocketAWB) {
    return next(new AppError('AWB not generated yet. Generate AWB first.', 400));
  }

  try {
    const pickupResponse = await shippingService.schedulePickup([order.shiprocketShipmentId]);

    // Update order shipping status
    order.shippingStatus = 'processing';
    order.pickupScheduled = true;
    order.pickupToken = pickupResponse.response?.pickup_token_number;
    await order.save();

    // Log admin activity
    await AdminActivity.logActivity({
      adminUser: req.user.id,
      action: 'schedule_pickup',
      entityType: 'Order',
      entityId: order._id,
      metadata: {
        orderId: order.orderId,
        pickupToken: pickupResponse.response?.pickup_token_number
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      status: 'success',
      message: 'Pickup scheduled successfully',
      data: {
        pickupToken: pickupResponse.response?.pickup_token_number,
        pickupScheduledDate: pickupResponse.response?.pickup_scheduled_date,
        order
      }
    });
  } catch (error) {
    console.error('Shiprocket pickup error:', error.response?.data || error.message);
    return next(new AppError(
      error.response?.data?.message || 'Failed to schedule pickup',
      500
    ));
  }
});

// @desc    Track shipment
// @route   GET /api/v1/admin/orders/:id/track-shipment
// @access  Private/Admin
exports.trackShipment = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (!order.shiprocketAWB && !order.shiprocketShipmentId) {
    return next(new AppError('No tracking information available for this order', 400));
  }

  try {
    let trackingData;

    if (order.shiprocketAWB) {
      trackingData = await shippingService.trackShipment(order.shiprocketAWB);
    } else {
      trackingData = await shippingService.trackByShipmentId(order.shiprocketShipmentId);
    }

    // Update order status based on tracking
    if (trackingData.tracking_data) {
      const currentStatus = trackingData.tracking_data.shipment_status;

      // Map Shiprocket status to our status
      const statusMap = {
        '1': 'pending',      // AWB Assigned
        '2': 'processing',   // Pickup Scheduled
        '3': 'processing',   // Pickup Queued
        '4': 'processing',   // Pickup Completed
        '5': 'shipped',      // In Transit
        '6': 'shipped',      // Out For Delivery
        '7': 'delivered',    // Delivered
        '8': 'cancelled',    // Cancelled
        '9': 'returned',     // RTO Initiated
        '10': 'returned'     // RTO Delivered
      };

      const mappedStatus = statusMap[currentStatus] || order.shippingStatus;

      if (order.shippingStatus !== mappedStatus) {
        order.shippingStatus = mappedStatus;
        if (mappedStatus === 'delivered') {
          order.status = 'delivered';
          order.deliveredAt = new Date();
        }
        await order.save();
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        tracking: trackingData.tracking_data,
        activities: trackingData.tracking_data?.shipment_track_activities || [],
        currentStatus: order.shippingStatus,
        order: {
          orderId: order.orderId,
          awb: order.shiprocketAWB,
          courier: order.courierName,
          estimatedDelivery: order.estimatedDelivery
        }
      }
    });
  } catch (error) {
    console.error('Shiprocket tracking error:', error.response?.data || error.message);
    return next(new AppError(
      error.response?.data?.message || 'Failed to fetch tracking information',
      500
    ));
  }
});

// @desc    Cancel shipment
// @route   POST /api/v1/admin/orders/:id/cancel-shipment
// @access  Private/Admin
exports.cancelShipment = catchAsync(async (req, res, next) => {
  const { reason } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (!order.shiprocketShipmentId) {
    return next(new AppError('No shipment found for this order', 400));
  }

  // Check if shipment can be cancelled (not delivered)
  if (['delivered', 'returned'].includes(order.shippingStatus)) {
    return next(new AppError('Cannot cancel delivered or returned shipment', 400));
  }

  try {
    await shippingService.cancelShipment(order.shiprocketShipmentId);

    // Update order
    order.shippingStatus = 'cancelled';
    order.shipmentCancellationReason = reason;
    await order.save();

    // Log admin activity
    await AdminActivity.logActivity({
      adminUser: req.user.id,
      action: 'cancel_shipment',
      entityType: 'Order',
      entityId: order._id,
      metadata: {
        orderId: order.orderId,
        shiprocketShipmentId: order.shiprocketShipmentId,
        reason
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      status: 'success',
      message: 'Shipment cancelled successfully',
      data: { order }
    });
  } catch (error) {
    console.error('Shiprocket cancellation error:', error.response?.data || error.message);
    return next(new AppError(
      error.response?.data?.message || 'Failed to cancel shipment',
      500
    ));
  }
});

// @desc    Print shipping label
// @route   GET /api/v1/admin/orders/:id/shipping-label
// @access  Private/Admin
exports.printShippingLabel = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (!order.shiprocketShipmentId) {
    return next(new AppError('No shipment found for this order', 400));
  }

  try {
    const labelResponse = await shippingService.printLabel([order.shiprocketShipmentId]);

    res.status(200).json({
      status: 'success',
      data: {
        labelUrl: labelResponse.label_url,
        labels: labelResponse.response?.labels
      }
    });
  } catch (error) {
    console.error('Shiprocket label error:', error.response?.data || error.message);
    return next(new AppError(
      error.response?.data?.message || 'Failed to generate shipping label',
      500
    ));
  }
});

// @desc    Get shipping charges estimate
// @route   POST /api/v1/admin/orders/:id/shipping-charges
// @access  Private/Admin
exports.getShippingChargesEstimate = catchAsync(async (req, res, next) => {
  const { weight, length, breadth, height } = req.body;

  const order = await Order.findById(req.params.id).populate('addresses');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const shippingAddress = order.addresses.find(addr => addr.type === 'shipping');

  if (!shippingAddress) {
    return next(new AppError('Shipping address not found', 400));
  }

  const pickupPincode = process.env.PICKUP_PINCODE || '400001';

  try {
    const chargesResponse = await shippingService.getShippingCharges(
      pickupPincode,
      shippingAddress.pincode,
      weight || 0.5,
      { length: length || 10, breadth: breadth || 10, height: height || 10 }
    );

    res.status(200).json({
      status: 'success',
      data: {
        charges: chargesResponse.data?.available_courier_companies || [],
        recommended: chargesResponse.data?.recommended_courier_company_id
      }
    });
  } catch (error) {
    console.error('Shiprocket charges error:', error.response?.data || error.message);
    return next(new AppError(
      error.response?.data?.message || 'Failed to calculate shipping charges',
      500
    ));
  }
});

// @desc    Generate manifest for multiple orders
// @route   POST /api/v1/admin/orders/generate-manifest
// @access  Private/Admin
exports.generateManifest = catchAsync(async (req, res, next) => {
  const { orderIds } = req.body;

  if (!orderIds || !orderIds.length) {
    return next(new AppError('No orders selected', 400));
  }

  // Get shipment IDs for all orders
  const orders = await Order.find({ _id: { $in: orderIds } });

  const shipmentIds = orders
    .filter(order => order.shiprocketShipmentId)
    .map(order => order.shiprocketShipmentId);

  if (!shipmentIds.length) {
    return next(new AppError('No shipments found for selected orders', 400));
  }

  try {
    const manifestResponse = await shippingService.generateManifest(shipmentIds);

    res.status(200).json({
      status: 'success',
      data: {
        manifestUrl: manifestResponse.manifest_url,
        manifestDetails: manifestResponse
      }
    });
  } catch (error) {
    console.error('Shiprocket manifest error:', error.response?.data || error.message);
    return next(new AppError(
      error.response?.data?.message || 'Failed to generate manifest',
      500
    ));
  }
});