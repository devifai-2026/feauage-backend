const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  subtitle: {
    type: String,
    trim: true,
    maxlength: [200, 'Subtitle cannot exceed 200 characters']
  },
  image: {
    type: String,
    required: [true, 'Image URL is required']
  },
  mobileImage: String,
  bannerType: {
    type: String,
    enum: ['header', 'footer', 'promotional', 'slider'],
    default: 'header'
  },
  linkType: {
    type: String,
    enum: ['product', 'category', 'collection', 'url', 'none'],
    default: 'none'
  },
  linkTarget: String,
  page: {
    type: String,
    enum: ['home', 'category', 'product', 'cart', 'checkout', 'all'],
    default: 'home'
  },
  position: {
    type: String,
    enum: ['top', 'middle', 'bottom', 'sidebar', 'popup'],
    default: 'top'
  },
  displayOrder: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  backgroundColor: String,
  textColor: String,
  buttonText: String,
  buttonColor: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
bannerSchema.index({ page: 1, position: 1, displayOrder: 1 });
bannerSchema.index({ isActive: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });
bannerSchema.index({ createdBy: 1 });
bannerSchema.index({ bannerType: 1 });

// Virtual for validity status
bannerSchema.virtual('isValid').get(function() {
  const now = new Date();
  return (
    this.isActive &&
    this.startDate <= now &&
    (!this.endDate || this.endDate >= now)
  );
});

// Virtual for target URL
bannerSchema.virtual('targetUrl').get(function() {
  if (!this.linkTarget) return '#';
  
  switch (this.linkType) {
    case 'product':
      return `/products/${this.linkTarget}`;
    case 'category':
      return `/categories/${this.linkTarget}`;
    case 'collection':
      return `/collections/${this.linkTarget}`;
    case 'url':
      return this.linkTarget;
    default:
      return '#';
  }
});

// Pre-save middleware
bannerSchema.pre('save', function(next) {
  // Ensure endDate is after startDate
  if (this.endDate && this.endDate <= this.startDate) {
    this.endDate = new Date(this.startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later
  }
  next();
});

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;