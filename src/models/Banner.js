const mongoose = require('mongoose');

const bannerImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, 'Image URL is required']
  },
  alt: {
    type: String,
    default: ''
  },
  subheader: {
    type: String,
    default: '',
    maxlength: [300, 'Subheader cannot exceed 300 characters']
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isPrimary: {
    type: Boolean,
    default: false
  }
}, {
  _id: true,
  minimize: false
});

const bannerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Banner name is required'],
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  subheader: {
    type: String,
    trim: true,
    maxlength: [300, 'Subheader cannot exceed 300 characters']
  },
  body: {
    type: String,
    trim: true,
    maxlength: [1000, 'Body cannot exceed 1000 characters']
  },
  footer: {
    type: String,
    trim: true,
    maxlength: [200, 'Footer cannot exceed 200 characters']
  },
  images: {
    type: [bannerImageSchema],
    validate: {
      validator: function (images) {
        return images && images.length > 0;
      },
      message: 'At least one image is required'
    }
  },
  redirectUrl: {
    type: String,
    trim: true
  },
  linkType: {
    type: String,
    enum: ['product', 'category', 'collection', 'url', 'none'],
    default: 'none'
  },
  linkTarget: {
    type: String,
    trim: true
  },
  bannerType: {
    type: String,
    enum: ['header', 'footer', 'promotional', 'slider', 'hero'],
    default: 'promotional'
  },
  page: {
    type: String,
    enum: ['home', 'category', 'product', 'cart', 'checkout', 'all'],
    default: 'home'
  },
  position: {
    type: String,
    enum: ['top', 'middle', 'bottom', 'sidebar', 'popup', 'hero'],
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
  promoCode: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true, // Allow multiple null values, but unique non-null values
    validate: {
      validator: function (v) {
        if (!v) return true;
        return /^[A-Z0-9]{4,20}$/.test(v);
      },
      message: 'Promo code must be 4-20 characters (letters and numbers only)'
    }
  },
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
bannerSchema.index({ name: 1 }, { unique: true });
bannerSchema.index({ page: 1, position: 1, displayOrder: 1 });
bannerSchema.index({ isActive: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });
bannerSchema.index({ createdBy: 1 });
bannerSchema.index({ bannerType: 1 });
bannerSchema.index({ promoCode: 1 }, { sparse: true, unique: true });

// Virtual for validity status
bannerSchema.virtual('isValid').get(function () {
  const now = new Date();
  return (
    this.isActive &&
    this.startDate <= now &&
    (!this.endDate || this.endDate >= now)
  );
});

// Virtual for primary image
bannerSchema.virtual('primaryImage').get(function () {
  if (!this.images || this.images.length === 0) return null;
  const primary = this.images.find(img => img.isPrimary);
  return primary || this.images[0];
});

// Pre-save middleware
bannerSchema.pre('save', function (next) {
  // Ensure endDate is after startDate
  if (this.endDate && this.endDate <= this.startDate) {
    this.endDate = new Date(this.startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later
  }

  // Ensure at least one image is marked as primary
  if (this.images && this.images.length > 0) {
    const hasPrimary = this.images.some(img => img.isPrimary);
    if (!hasPrimary) {
      this.images[0].isPrimary = true;
    }
  }

  next();
});

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;