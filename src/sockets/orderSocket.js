const socketIO = require('socket.io');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const Product = require('../models/Product');

let io;
const adminSockets = new Map(); // Map to store admin socket connections

exports.initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });
  
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Admin joins admin room
    socket.on('admin-join', (userId) => {
      socket.join('admin-room');
      adminSockets.set(userId, socket.id);
      console.log(`Admin ${userId} joined admin room`);
    });
    
    // User joins their personal room
    socket.on('user-join', (userId) => {
      socket.join(`user-${userId}`);
      console.log(`User ${userId} joined their room`);
    });
    
    // Handle order updates from admin
    socket.on('order-update', (data) => {
      const { orderId, userId, status } = data;
      io.to(`user-${userId}`).emit('order-status-update', {
        orderId,
        status,
        timestamp: new Date()
      });
    });
    
    // Handle shipping updates
    socket.on('shipping-update', (data) => {
      const { orderId, userId, shippingStatus, trackingNumber } = data;
      io.to(`user-${userId}`).emit('shipping-status-update', {
        orderId,
        shippingStatus,
        trackingNumber,
        timestamp: new Date()
      });
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      // Remove from adminSockets map
      for (const [userId, socketId] of adminSockets.entries()) {
        if (socketId === socket.id) {
          adminSockets.delete(userId);
          break;
        }
      }
    });
  });
  
  return io;
};

// Emit order notification to admin room
exports.emitOrderNotification = (event, data) => {
  if (io) {
    io.to('admin-room').emit(event, {
      ...data,
      timestamp: new Date()
    });
    
    // Also emit to specific user if needed
    if (data.userId) {
      io.to(`user-${data.userId}`).emit(`${event}_user`, {
        ...data,
        timestamp: new Date()
      });
    }
  }
};

// Get socket instance
exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Notify admin about new order
exports.notifyNewOrder = async (orderId) => {
  try {
    const order = await Order.findById(orderId)
      .populate('user', 'firstName lastName');

    if (!order) return;

    const notificationData = {
      type: 'new_order',
      orderId: order.orderId,
      orderDbId: order._id,
      userId: order.user?._id,
      userName: order.user ? `${order.user.firstName} ${order.user.lastName}` : 'Guest',
      total: order.grandTotal,
      itemsCount: order.items?.length || 0,
      timestamp: new Date()
    };

    // Emit real-time notification
    exports.emitOrderNotification('new_order', notificationData);

    // Persist notification to database
    await Notification.createOrderNotification(order, 'new_order');

  } catch (error) {
    console.error('Error notifying new order:', error);
  }
};

// Notify low stock
exports.notifyLowStock = async (productId) => {
  try {
    const product = await Product.findById(productId);

    if (!product) return;

    const notificationData = {
      type: 'low_stock',
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      currentStock: product.stockQuantity,
      threshold: product.lowStockThreshold,
      timestamp: new Date()
    };

    // Emit real-time notification
    exports.emitOrderNotification('low_stock_alert', notificationData);

    // Persist notification to database
    await Notification.createStockAlert(product, 'low_stock');

  } catch (error) {
    console.error('Error notifying low stock:', error);
  }
};

// Notify payment received
exports.notifyPaymentReceived = async (orderId, paymentId) => {
  try {
    const order = await Order.findById(orderId);
    
    if (!order) return;
    
    const notification = {
      type: 'payment_received',
      orderId: order.orderId,
      paymentId,
      amount: order.grandTotal,
      timestamp: new Date()
    };
    
    exports.emitOrderNotification('payment_received', notification);
    
  } catch (error) {
    console.error('Error notifying payment:', error);
  }
};