const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  url: {
    type: String,
    required: [true, 'Image URL is required']
  },
  altText: {
    type: String,
    default: 'Product image',
    maxlength: [200, 'Alt text cannot exceed 200 characters']
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  displayOrder: {
    type: Number,
    default: 0,
    min: 0
  },
  size: {
    type: Number,
    min: 0
  },
  dimensions: {
    width: Number,
    height: Number
  },
  mimeType: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
productImageSchema.index({ product: 1, displayOrder: 1 });
productImageSchema.index({ product: 1, isPrimary: 1 });
productImageSchema.index({ uploadedBy: 1 });

// Ensure only one primary image per product
productImageSchema.pre('save', async function(next) {
  if (this.isPrimary) {
    await mongoose.model('ProductImage').updateMany(
      { product: this.product, _id: { $ne: this._id } },
      { $set: { isPrimary: false } }
    );
  }
  next();
});

const ProductImage = mongoose.model('ProductImage', productImageSchema);

module.exports = ProductImage;