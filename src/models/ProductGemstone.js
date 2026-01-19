const mongoose = require('mongoose');

const productGemstoneSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  name: {
    type: String,
    required: [true, 'Gemstone name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Gemstone type is required'],
    trim: true
  },
  color: {
    type: String,
    required: [true, 'Gemstone color is required'],
    trim: true
  },
  clarity: {
    type: String,
    required: [true, 'Gemstone clarity is required'],
    trim: true
  },
  carat: {
    type: Number,
    required: [true, 'Carat weight is required'],
    min: [0.01, 'Carat must be at least 0.01']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  cut: String,
  shape: String,
  treatment: String,
  origin: String,
  certificationNumber: String,
  certificationAuthority: String,
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
productGemstoneSchema.index({ product: 1 });
productGemstoneSchema.index({ name: 1 });
productGemstoneSchema.index({ type: 1 });
productGemstoneSchema.index({ color: 1 });

const ProductGemstone = mongoose.model('ProductGemstone', productGemstoneSchema);

module.exports = ProductGemstone;