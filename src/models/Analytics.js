const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Analytics type is required'],
    enum: ['page_view', 'product_view', 'category_view', 'search', 'add_to_cart', 'add_to_wishlist', 'purchase', 'checkout_start', 'checkout_complete']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'entityType'
  },
  entityType: {
    type: String,
    enum: ['Product', 'Category', 'User', null]
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sessionId: {
    type: String,
    required: [true, 'Session ID is required']
  },
  ipAddress: String,
  userAgent: String,
  referrer: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for fast queries
analyticsSchema.index({ type: 1, date: 1 });
analyticsSchema.index({ entityId: 1, entityType: 1, date: 1 });
analyticsSchema.index({ user: 1, date: 1 });
analyticsSchema.index({ sessionId: 1 });
analyticsSchema.index({ timestamp: -1 });
analyticsSchema.index({ date: 1, type: 1, entityId: 1 });

// Pre-save middleware to set date field
analyticsSchema.pre('save', function(next) {
  // Set date to beginning of day for aggregation
  const date = new Date(this.timestamp || Date.now());
  date.setHours(0, 0, 0, 0);
  this.date = date;
  next();
});

// Static method to get daily statistics
analyticsSchema.statics.getDailyStats = async function(startDate, endDate) {
  const matchStage = {
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: '$date',
          type: '$type'
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$user' },
        uniqueSessions: { $addToSet: '$sessionId' }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id.date',
        type: '$_id.type',
        count: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        uniqueSessionCount: { $size: '$uniqueSessions' }
      }
    },
    { $sort: { date: 1, type: 1 } }
  ]);
};

// Static method to get product analytics
analyticsSchema.statics.getProductAnalytics = async function(productId, startDate, endDate) {
  const matchStage = {
    entityId: productId,
    entityType: 'Product',
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: '$date',
          type: '$type'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        views: {
          $sum: {
            $cond: [{ $eq: ['$_id.type', 'product_view'] }, '$count', 0]
          }
        },
        addsToCart: {
          $sum: {
            $cond: [{ $eq: ['$_id.type', 'add_to_cart'] }, '$count', 0]
          }
        },
        addsToWishlist: {
          $sum: {
            $cond: [{ $eq: ['$_id.type', 'add_to_wishlist'] }, '$count', 0]
          }
        }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        views: 1,
        addsToCart: 1,
        addsToWishlist: 1
      }
    }
  ]);
};

// Static method to get popular products
analyticsSchema.statics.getPopularProducts = async function(limit = 10, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        type: 'product_view',
        date: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$entityId',
        viewCount: { $sum: 1 },
        uniqueViewers: { $addToSet: '$user' }
      }
    },
    { $sort: { viewCount: -1 } },
    { $limit: limit },
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
        _id: 0,
        productId: '$_id',
        productName: '$product.name',
        productSku: '$product.sku',
        viewCount: 1,
        uniqueViewerCount: { $size: '$uniqueViewers' }
      }
    }
  ]);
};

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;