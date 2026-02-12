const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [50, 'SKU cannot exceed 50 characters']
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    minlength: [50, 'Description must be at least 50 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [300, 'Short description cannot exceed 300 characters']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory'
  },
  brand: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'unisex', 'kids'],
    default: 'unisex'
  },
  // Pricing
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Price cannot be negative']
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Selling price is required'],
    min: [0, 'Price cannot be negative']
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'none'],
    default: 'none'
  },
  discountValue: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function (v) {
        if (this.discountType === 'percentage') {
          return v <= 100;
        }
        return true;
      },
      message: 'Percentage discount cannot exceed 100%'
    }
  },
  offerPrice: {
    type: Number,
    min: 0
  },
  offerStartDate: Date,
  offerEndDate: Date,
  isOnOffer: {
    type: Boolean,
    default: false
  },
  // Stock Management
  stockQuantity: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  stockStatus: {
    type: String,
    enum: ['in_stock', 'low_stock', 'out_of_stock'],
    default: 'out_of_stock'
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: 0
  },
  manageStock: {
    type: Boolean,
    default: true
  },
  // Product Attributes
  material: {
    type: String,
    enum: ['gold', 'silver', 'platinum', 'diamond', 'pearl', 'gemstone', 'other'],
    required: true
  },
  purity: {
    type: String,
    enum: ['14k', '18k', '22k', '24k', '925', '950', '999', 'na']
  },
  weight: {
    type: Number,
    min: 0
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  // Status Flags
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isNewArrival: {
    type: Boolean,
    default: true
  },
  isBestSeller: {
    type: Boolean,
    default: false
  },
  // Analytics
  viewCount: {
    type: Number,
    default: 0
  },
  purchaseCount: {
    type: Number,
    default: 0
  },
  ratingAverage: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
    set: val => Math.round(val * 10) / 10
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  // SEO
  metaTitle: String,
  metaDescription: String,
  metaKeywords: [String],
  // Tags for search
  tags: [String],
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ category: 1, subCategory: 1 });
productSchema.index({ material: 1 });
productSchema.index({ gender: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ 'tags': 'text', 'name': 'text', 'description': 'text' });
productSchema.index({ isActive: 1, isFeatured: 1, isNewArrival: 1 });
productSchema.index({ sellingPrice: 1 });
productSchema.index({ stockStatus: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ ratingAverage: -1, purchaseCount: -1 });
productSchema.index({ offerPrice: 1 });

// Virtual for reviews
productSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'product',
  localField: '_id'
});

// Virtual for stock history
productSchema.virtual('stockHistory', {
  ref: 'StockHistory',
  foreignField: 'product',
  localField: '_id'
});

// Virtual for images
productSchema.virtual('images', {
  ref: 'ProductImage',
  foreignField: 'product',
  localField: '_id'
});

// Virtual for gemstones
productSchema.virtual('gemstones', {
  ref: 'ProductGemstone',
  foreignField: 'product',
  localField: '_id'
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function () {
  if (this.discountType === 'percentage') {
    return this.discountValue;
  } else if (this.discountType === 'fixed' && this.basePrice > 0) {
    return Math.round((this.discountValue / this.basePrice) * 100);
  }
  return 0;
});

// Helper function to calculate stock status
const calculateStockStatus = (quantity, threshold) => {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= threshold) return 'low_stock';
  return 'in_stock';
};

// Pre-validate middleware
productSchema.pre('validate', function (next) {
  // Generate slug from name
  if (this.isModified('name') || !this.slug) {
    const slugSource = this.name || '';
    if (slugSource) {
      this.slug = slugify(slugSource, {
        lower: true,
        strict: true,
        trim: true
      });
    }
  }

  // Calculate stock status
  this.stockStatus = calculateStockStatus(this.stockQuantity, this.lowStockThreshold);

  // Calculate offer price
  const now = new Date();
  if (this.isOnOffer && this.offerStartDate <= now && this.offerEndDate >= now) {
    if (this.discountType === 'percentage') {
      this.offerPrice = this.sellingPrice * (1 - this.discountValue / 100);
    } else if (this.discountType === 'fixed') {
      this.offerPrice = this.sellingPrice - this.discountValue;
    } else {
      this.offerPrice = this.sellingPrice;
    }
  } else {
    this.offerPrice = this.sellingPrice;
    this.isOnOffer = false;
  }

  next();
});

// Update stock status on findOneAndUpdate
productSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  
  // If stockQuantity or lowStockThreshold is being updated
  if (update.stockQuantity !== undefined || update.lowStockThreshold !== undefined) {
    // Get current document to get values not being updated
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      const quantity = update.stockQuantity !== undefined ? update.stockQuantity : docToUpdate.stockQuantity;
      const threshold = update.lowStockThreshold !== undefined ? update.lowStockThreshold : docToUpdate.lowStockThreshold;
      
      update.stockStatus = calculateStockStatus(quantity, threshold);
    }
  }
  next();
});

// Static method to update stock
productSchema.statics.updateStock = async function (productId, quantity, type, userId, referenceId, reason, notes) {
  const product = await this.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  const previousStock = product.stockQuantity;
  let newStock;

  switch (type) {
    case 'stock_in':
      newStock = previousStock + quantity;
      break;
    case 'stock_out':
      if (previousStock < quantity) {
        throw new Error('Insufficient stock');
      }
      newStock = previousStock - quantity;
      break;
    case 'adjustment':
      newStock = quantity;
      break;
    default:
      throw new Error('Invalid stock update type');
  }

  product.stockQuantity = newStock;
  await product.save();

  // Create stock history record
  const StockHistory = mongoose.model('StockHistory');
  await StockHistory.create({
    product: productId,
    sku: product.sku,
    type,
    quantity: Math.abs(quantity),
    previousStock,
    newStock,
    reason,
    referenceId,
    referenceType: referenceId ? 'order' : 'manual',
    performedBy: userId,
    notes
  });

  return product;
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;