const socketIO = require('socket.io');

let io;

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