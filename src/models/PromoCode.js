const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Promo code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  discountPercentage: {
    type: Number,
    required: [true, 'Discount percentage is required'],
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSecret: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Banner',
    sparse: true // Allow null for manually created codes, but index non-null values
  },
  applicableCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  minimumPurchase: {
    type: Number,
    default: 0
  },
  firstTimeOnly: {
    type: Boolean,
    default: false
  },
  maxUses: {
    type: Number,
    default: 0
  },
  usedCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);

module.exports = PromoCode;
