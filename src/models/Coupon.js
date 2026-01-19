const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Coupon name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: [true, 'Discount type is required']
  },
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0, 'Discount value cannot be negative']
  },
  minPurchaseAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxDiscountAmount: {
    type: Number,
    min: 0
  },
  validFrom: {
    type: Date,
    required: [true, 'Valid from date is required']
  },
  validUntil: {
    type: Date,
    required: [true, 'Valid until date is required']
  },
  usageLimit: {
    type: Number,
    default: null,
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicableCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  excludedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  singleUsePerUser: {
    type: Boolean,
    default: false
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
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });
couponSchema.index({ createdBy: 1 });

// Virtual for validity status
couponSchema.virtual('isValid').get(function() {
  const now = new Date();
  return (
    this.isActive &&
    this.validFrom <= now &&
    this.validUntil >= now &&
    (!this.usageLimit || this.usedCount < this.usageLimit)
  );
});

// Virtual for formatted validity period
couponSchema.virtual('formattedValidity').get(function() {
  return `${this.validFrom.toLocaleDateString()} - ${this.validUntil.toLocaleDateString()}`;
});

// Method to validate coupon
couponSchema.methods.validateCoupon = function(cartTotal, userId, productIds = []) {
  const now = new Date();
  
  // Check basic validity
  if (!this.isActive) {
    return { isValid: false, message: 'Coupon is not active' };
  }
  
  if (now < this.validFrom || now > this.validUntil) {
    return { isValid: false, message: 'Coupon is not valid at this time' };
  }
  
  if (this.usageLimit && this.usedCount >= this.usageLimit) {
    return { isValid: false, message: 'Coupon usage limit exceeded' };
  }
  
  // Check minimum purchase amount
  if (cartTotal < this.minPurchaseAmount) {
    return { 
      isValid: false, 
      message: `Minimum purchase amount of ₹${this.minPurchaseAmount} required` 
    };
  }
  
  // Calculate discount
  let discountAmount = 0;
  
  if (this.discountType === 'percentage') {
    discountAmount = (cartTotal * this.discountValue) / 100;
  } else {
    discountAmount = this.discountValue;
  }
  
  // Apply max discount limit
  if (this.maxDiscountAmount && discountAmount > this.maxDiscountAmount) {
    discountAmount = this.maxDiscountAmount;
  }
  
  return {
    isValid: true,
    discountAmount,
    message: 'Coupon applied successfully'
  };
};

// Method to apply coupon
couponSchema.methods.applyCoupon = async function() {
  this.usedCount += 1;
  await this.save();
  return this;
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;