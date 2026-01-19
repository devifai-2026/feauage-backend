const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  // Pricing
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingCharge: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    required: [true, 'Grand total is required'],
    min: [0, 'Grand total cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  // Payment
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cod', 'card', 'wallet', 'netbanking', 'upi'],
    required: [true, 'Payment method is required']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  // Shipping
  shippingProvider: {
    type: String,
    default: 'shiprocket'
  },
  shiprocketOrderId: String,
  shiprocketShipmentId: String,
  trackingNumber: String,
  shippingStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  },
  estimatedDelivery: Date,
  deliveredAt: Date,
  // Order Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'],
    default: 'pending'
  },
  cancellationReason: String,
  // Invoice
  invoiceNumber: String,
  invoiceUrl: String,
  // Audit
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
orderSchema.index({ orderId: 1 }, { unique: true });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ shippingStatus: 1 });
orderSchema.index({ razorpayOrderId: 1 });
orderSchema.index({ shiprocketOrderId: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ trackingNumber: 1 });

// Virtual for items
orderSchema.virtual('items', {
  ref: 'OrderItem',
  foreignField: 'order',
  localField: '_id'
});

// Virtual for addresses
orderSchema.virtual('addresses', {
  ref: 'OrderAddress',
  foreignField: 'order',
  localField: '_id'
});

// Virtual for formatted date
orderSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
});

// Virtual for item count
orderSchema.virtual('itemCount').get(async function() {
  const OrderItem = mongoose.model('OrderItem');
  const items = await OrderItem.find({ order: this._id });
  return items.reduce((sum, item) => sum + item.quantity, 0);
});

// Pre-save middleware to generate order ID
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get count of today's orders
    const Order = mongoose.model('Order');
    const count = await Order.countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      }
    });
    
    this.orderId = `ORD${year}${month}${day}${String(count + 1).padStart(4, '0')}`;
    
    // Generate invoice number
    this.invoiceNumber = `INV${year}${month}${day}${String(count + 1).padStart(4, '0')}`;
  }
  
  this.updatedAt = Date.now();
  next();
});

// Post-save middleware to update product purchase count and target progress
orderSchema.post('save', async function(doc) {
  try {
    if (doc.status === 'delivered') {
      const Product = mongoose.model('Product');
      const OrderItem = mongoose.model('OrderItem');
      const Target = mongoose.model('Target');
      
      // Update product purchase counts
      const items = await OrderItem.find({ order: doc._id });
      
      for (const item of items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { purchaseCount: item.quantity }
        });
      }
      
      // Update target progress
      // Find all active revenue targets for this user that include the order date
      const activeTargets = await Target.find({
        userId: doc.user,
        targetType: 'revenue',
        isActive: true,
        startDate: { $lte: doc.createdAt },
        endDate: { $gte: doc.createdAt },
        status: 'active'
      });
      
      // Update each target
      for (const target of activeTargets) {
        // Calculate total delivered revenue for this user within the target period
        const totalRevenue = await Order.aggregate([
          {
            $match: {
              user: doc.user,
              status: 'delivered',
              createdAt: {
                $gte: target.startDate,
                $lte: target.endDate
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$grandTotal' }
            }
          }
        ]);
        
        const currentValue = totalRevenue[0]?.total || 0;
        
        // Update the target's current value and let the pre-save hook calculate progress
        await Target.findByIdAndUpdate(target._id, {
          currentValue: currentValue,
          lastUpdatedBy: doc.user
        }, { runValidators: true });
      }
    }
  } catch (error) {
    console.error('Error in order post-save hook:', error);
    // Don't throw error to prevent order creation from failing
  }
});

// Post-findOneAndUpdate middleware to handle status changes
orderSchema.post('findOneAndUpdate', async function(doc) {
  try {
    if (doc && this.getUpdate().$set && this.getUpdate().$set.status === 'delivered') {
      const Target = mongoose.model('Target');
      const Order = mongoose.model('Order');
      
      // Find all active revenue targets for this user that include the order date
      const activeTargets = await Target.find({
        userId: doc.user,
        targetType: 'revenue',
        isActive: true,
        startDate: { $lte: doc.createdAt },
        endDate: { $gte: doc.createdAt },
        status: 'active'
      });
      
      // Update each target
      for (const target of activeTargets) {
        // Calculate total delivered revenue for this user within the target period
        const totalRevenue = await Order.aggregate([
          {
            $match: {
              user: doc.user,
              status: 'delivered',
              createdAt: {
                $gte: target.startDate,
                $lte: target.endDate
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$grandTotal' }
            }
          }
        ]);
        
        const currentValue = totalRevenue[0]?.total || 0;
        
        // Update the target's current value
        await Target.findByIdAndUpdate(target._id, {
          currentValue: currentValue,
          lastUpdatedBy: doc.user
        }, { runValidators: true });
      }
    }
  } catch (error) {
    console.error('Error in order findOneAndUpdate hook:', error);
  }
});

// Static method to get order statistics
orderSchema.statics.getStatistics = async function(startDate, endDate) {
  const matchStage = {};
  
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$grandTotal' },
        averageOrderValue: { $avg: '$grandTotal' },
        pendingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        confirmedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
        },
        processingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
        },
        shippedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] }
        },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    processingOrders: 0,
    shippedOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0
  };
};

// Helper method to update target progress
orderSchema.statics.updateTargetProgress = async function(userId, orderId) {
  try {
    const Order = mongoose.model('Order');
    const Target = mongoose.model('Target');
    
    // Get the order
    const order = await Order.findById(orderId);
    if (!order || order.status !== 'delivered') return;
    
    // Find all active revenue targets for this user that include the order date
    const activeTargets = await Target.find({
      userId: order.user,
      targetType: 'revenue',
      isActive: true,
      startDate: { $lte: order.createdAt },
      endDate: { $gte: order.createdAt },
      status: 'active'
    });
    
    // Update each target
    for (const target of activeTargets) {
      // Calculate total delivered revenue for this user within the target period
      const totalRevenue = await Order.aggregate([
        {
          $match: {
            user: order.user,
            status: 'delivered',
            createdAt: {
              $gte: target.startDate,
              $lte: target.endDate
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$grandTotal' }
          }
        }
      ]);
      
      const currentValue = totalRevenue[0]?.total || 0;
      
      // Update the target's current value
      await Target.findByIdAndUpdate(target._id, {
        currentValue: currentValue,
        lastUpdatedBy: userId || order.user
      }, { runValidators: true });
    }
  } catch (error) {
    console.error('Error updating target progress:', error);
    throw error;
  }
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;