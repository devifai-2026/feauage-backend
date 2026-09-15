const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  // Optional: admin-authored reviews (real testimonials collected offline)
  // have no user account behind them. Shopper-submitted reviews always do.
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Set only on admin-authored reviews, so the storefront can label them
  // honestly rather than passing them off as verified shopper submissions.
  source: {
    type: String,
    enum: ['customer', 'admin'],
    default: 'customer'
  },
  // Display name for admin-authored reviews (no user doc to populate from).
  authorName: {
    type: String,
    trim: true,
    maxlength: [100, 'Author name cannot exceed 100 characters']
  },
  createdByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Moderation trail
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  moderatedAt: Date,
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  // Audit: admin edits to shopper-written text must stay visible, so the
  // original wording is never silently lost.
  editedByAdmin: {
    type: Boolean,
    default: false
  },
  originalComment: String,
  originalTitle: String,
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  comment: {
    type: String,
    required: [true, 'Comment is required'],
    trim: true,
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  images: [{
    type: String
  }],
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  likes: {
    type: Number,
    default: 0,
    min: 0
  },
  dislikes: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  helpfulCount: {
    type: Number,
    default: 0,
    min: 0
  },
  reportedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  adminResponse: {
    response: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
// One review per shopper per product. partialFilterExpression keeps the
// constraint off admin-authored rows, which have user: null and would
// otherwise collide with each other on the second insert.
reviewSchema.index(
  { product: 1, user: 1 },
  { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } }
);
reviewSchema.index({ product: 1, rating: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ isApproved: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ rating: -1 });

// Virtual for formatted date
reviewSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
});

// Virtual for helpful percentage
reviewSchema.virtual('helpfulPercentage').get(function() {
  if (this.likes + this.dislikes === 0) return 0;
  return Math.round((this.likes / (this.likes + this.dislikes)) * 100);
});

// Pre-save middleware to update product ratings
// Post-save middleware to update product ratings
reviewSchema.post('save', async function() {
  await this.constructor.updateProductRatings(this.product);
});

// Post-deleteOne middleware to update product ratings
reviewSchema.post('deleteOne', { document: true, query: false }, async function() {
  await this.constructor.updateProductRatings(this.product);
});

// isApproved is the legacy flag; status is the source of truth. Mirror it on
// every save so old queries keep working during the transition.
reviewSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.isApproved = this.status === 'approved';
  } else if (this.isModified('isApproved')) {
    this.status = this.isApproved ? 'approved' : 'pending';
  }
  next();
});

// Static method to update product ratings
reviewSchema.statics.updateProductRatings = async function(productId) {
  const Review = mongoose.model('Review');
  const Product = mongoose.model('Product');
  
  const stats = await this.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        // Pending/rejected reviews must not move the public star rating.
        status: 'approved'
      }
    },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        count: { $sum: 1 },
        rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }
      }
    }
  ]);
  
  if (stats.length > 0) {
    const stat = stats[0];
    await Product.findByIdAndUpdate(productId, {
      ratingAverage: Math.round(stat.averageRating * 10) / 10,
      ratingCount: stat.count
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      ratingAverage: 0,
      ratingCount: 0
    });
  }
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;