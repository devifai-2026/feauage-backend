const mongoose = require('mongoose');

const flashSaleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Flash sale title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Sale price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  backgroundImage: {
    type: String,
    required: [true, 'Background image URL is required'],
    trim: true
  },
  productLink: {
    type: String,
    trim: true
  },
  promoCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  discountPercentage: {
    type: Number,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%'],
    default: 0
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative']
  },
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
flashSaleSchema.index({ isActive: 1, endDate: 1 });
flashSaleSchema.index({ createdAt: -1 });

// Static method to get the currently active flash sale
flashSaleSchema.statics.getActiveFlashSale = async function () {
  const now = new Date();
  const flashSale = await this.findOne({
    isActive: true,
    endDate: { $gt: now }
  }).sort({ createdAt: -1 });

  return flashSale || null;
};

const FlashSale = mongoose.model('FlashSale', flashSaleSchema);

module.exports = FlashSale;
