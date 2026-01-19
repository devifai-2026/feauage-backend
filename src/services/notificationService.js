const { emitOrderNotification } = require('../sockets/orderSocket');
const User = require('../models/User');

class NotificationService {
  // Send notification to admin
  static async notifyAdmin(type, data) {
    try {
      // Get all admin users
      const adminUsers = await User.find({
        role: { $in: ['admin', 'superadmin'] },
        isActive: true
      }).select('_id');
      
      // Emit socket notification
      emitOrderNotification(type, {
        ...data,
        timestamp: new Date()
      });
      
      // You can also send push notifications, emails, etc. here
      
      return true;
    } catch (error) {
      console.error('Error sending admin notification:', error);
      return false;
    }
  }

  // Send notification to user
  static async notifyUser(userId, type, data) {
    try {
      emitOrderNotification(`${type}_user`, {
        ...data,
        userId,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      console.error('Error sending user notification:', error);
      return false;
    }
  }

  // New order notification
  static async newOrder(order) {
    const user = await User.findById(order.user);
    
    await this.notifyAdmin('new_order', {
      orderId: order.orderId,
      userId: order.user,
      userName: user?.fullName || 'Customer',
      total: order.grandTotal,
      itemsCount: order.items?.length || 0
    });
  }

  // Order status update notification
  static async orderStatusUpdate(order, newStatus) {
    const user = await User.findById(order.user);
    
    await this.notifyUser(order.user, 'order_status_update', {
      orderId: order.orderId,
      status: newStatus,
      message: `Your order status has been updated to ${newStatus}`
    });
    
    await this.notifyAdmin('order_status_updated', {
      orderId: order.orderId,
      userId: order.user,
      userName: user?.fullName || 'Customer',
      status: newStatus
    });
  }

  // Shipping update notification
  static async shippingUpdate(order, shippingStatus, trackingNumber) {
    const user = await User.findById(order.user);
    
    await this.notifyUser(order.user, 'shipping_update', {
      orderId: order.orderId,
      shippingStatus,
      trackingNumber,
      message: `Your order shipping status has been updated to ${shippingStatus}`
    });
    
    await this.notifyAdmin('shipping_updated', {
      orderId: order.orderId,
      userId: order.user,
      userName: user?.fullName || 'Customer',
      shippingStatus,
      trackingNumber
    });
  }

  // Payment received notification
  static async paymentReceived(order, paymentId) {
    const user = await User.findById(order.user);
    
    await this.notifyAdmin('payment_received', {
      orderId: order.orderId,
      paymentId,
      amount: order.grandTotal,
      userId: order.user,
      userName: user?.fullName || 'Customer'
    });
  }

  // Low stock alert notification
  static async lowStockAlert(product) {
    await this.notifyAdmin('low_stock_alert', {
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      currentStock: product.stockQuantity,
      threshold: product.lowStockThreshold
    });
  }

  // New review notification
  static async newReview(review, product) {
    const user = await User.findById(review.user);
    
    await this.notifyAdmin('new_review', {
      reviewId: review._id,
      productId: product._id,
      productName: product.name,
      userId: review.user,
      userName: user?.fullName || 'Customer',
      rating: review.rating,
      needsApproval: !review.isApproved
    });
  }

  // New user registration notification
  static async newUser(user) {
    await this.notifyAdmin('new_user', {
      userId: user._id,
      userName: user.fullName,
      email: user.email,
      role: user.role
    });
  }

  // Return request notification
  static async returnRequest(order, reason) {
    const user = await User.findById(order.user);
    
    await this.notifyAdmin('return_request', {
      orderId: order.orderId,
      userId: order.user,
      userName: user?.fullName || 'Customer',
      reason,
      amount: order.grandTotal
    });
  }
}

module.exports = NotificationService;