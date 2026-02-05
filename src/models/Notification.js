const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'new_order',
      'order_update',
      'payment_received',
      'payment_failed',
      'low_stock',
      'out_of_stock',
      'new_user',
      'new_review',
      'refund_request',
      'shipping_update',
      'system',
      'admin_notification'
    ],
    required: true
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Who should receive this notification
  recipients: {
    type: [String],
    enum: ['admin', 'superadmin', 'user', 'all'],
    default: ['admin']
  },
  // Specific user IDs if targeted notification
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Track who has read the notification
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Related entity reference
  entityType: {
    type: String,
    enum: ['order', 'product', 'user', 'review', 'payment', 'system', null],
    default: null
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'entityType'
  },
  // Notification status
  isActive: {
    type: Boolean,
    default: true
  },
  // Auto-expire notifications
  expiresAt: {
    type: Date,
    default: function() {
      // Default expiry: 30 days from creation
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  },
  // Created by (for admin-generated notifications)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
notificationSchema.index({ type: 1 });
notificationSchema.index({ recipients: 1 });
notificationSchema.index({ 'readBy.user': 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ isActive: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ priority: 1 });

// Virtual for checking if notification is read by a specific user
notificationSchema.methods.isReadByUser = function(userId) {
  return this.readBy.some(read => read.user.toString() === userId.toString());
};

// Static method to get unread notifications for admin
notificationSchema.statics.getUnreadForAdmin = async function(adminId, limit = 20) {
  return this.find({
    recipients: { $in: ['admin', 'superadmin', 'all'] },
    isActive: true,
    'readBy.user': { $ne: adminId }
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .lean();
};

// Static method to get all notifications for admin with pagination
notificationSchema.statics.getAdminNotifications = async function(options = {}) {
  const {
    page = 1,
    limit = 20,
    offset,
    type,
    priority,
    unreadOnly = false,
    adminId
  } = options;

  const query = {
    recipients: { $in: ['admin', 'superadmin', 'all'] },
    isActive: true
  };

  if (type) query.type = type;
  if (priority) query.priority = priority;
  if (unreadOnly && adminId) {
    query['readBy.user'] = { $ne: adminId };
  }

  // Calculate skip value: use explicit offset if provided, otherwise fallback to page-based calculation
  const skip = offset !== undefined ? offset : (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    notifications,
    total,
    page: offset !== undefined ? Math.floor(offset / limit) + 1 : page,
    totalPages: Math.ceil(total / limit)
  };
};

// Static method to mark notification as read
notificationSchema.statics.markAsRead = async function(notificationId, userId) {
  return this.findByIdAndUpdate(
    notificationId,
    {
      $addToSet: {
        readBy: { user: userId, readAt: new Date() }
      }
    },
    { new: true }
  );
};

// Static method to mark all notifications as read for a user
notificationSchema.statics.markAllAsRead = async function(userId, recipients = ['admin', 'superadmin', 'all']) {
  return this.updateMany(
    {
      recipients: { $in: recipients },
      'readBy.user': { $ne: userId }
    },
    {
      $addToSet: {
        readBy: { user: userId, readAt: new Date() }
      }
    }
  );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId, recipients = ['admin', 'superadmin', 'all']) {
  return this.countDocuments({
    recipients: { $in: recipients },
    isActive: true,
    'readBy.user': { $ne: userId }
  });
};

// Static method to create order notification
notificationSchema.statics.createOrderNotification = async function(order, type = 'new_order') {
  const notificationData = {
    type,
    entityType: 'order',
    entityId: order._id,
    recipients: ['admin', 'superadmin'],
    priority: type === 'new_order' ? 'high' : 'medium'
  };

  switch (type) {
    case 'new_order':
      notificationData.title = 'New Order Received';
      // Format: [user] bought [product] on [date] at [time]
      const orderDate = new Date(order.createdAt || Date.now());
      const dateStr = orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      const productName = order.items && order.items.length > 0 ? order.items[0].productName : 'items';
      
      notificationData.message = `${order.user?.firstName || 'A customer'} bought ${productName}${order.items?.length > 1 ? ` and others` : ''} on ${dateStr} at ${timeStr}`;
      break;
    case 'order_update':
      notificationData.title = 'Order Status Updated';
      notificationData.message = `Order #${order.orderId} status changed to ${order.status}`;
      break;
    case 'payment_received':
      notificationData.title = 'Payment Received';
      notificationData.message = `Payment of ₹${order.grandTotal} received for order #${order.orderId}`;
      break;
    default:
      notificationData.title = 'Order Update';
      notificationData.message = `Order #${order.orderId} has been updated`;
  }

  notificationData.data = {
    orderId: order.orderId,
    orderDbId: order._id,
    userId: order.user?._id,
    userName: order.user ? `${order.user.firstName} ${order.user.lastName}` : 'Customer',
    total: order.grandTotal,
    status: order.status
  };

  return this.create(notificationData);
};

// Static method to create stock alert notification
notificationSchema.statics.createStockAlert = async function(product, alertType = 'low_stock') {
  return this.create({
    type: alertType,
    title: alertType === 'low_stock' ? 'Low Stock Alert' : 'Out of Stock Alert',
    message: `${product.name} (SKU: ${product.sku}) ${alertType === 'low_stock' ? 'is running low' : 'is out of stock'}. Current stock: ${product.stockQuantity}`,
    entityType: 'product',
    entityId: product._id,
    recipients: ['admin', 'superadmin'],
    priority: alertType === 'out_of_stock' ? 'urgent' : 'high',
    data: {
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      currentStock: product.stockQuantity,
      threshold: product.lowStockThreshold
    }
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
