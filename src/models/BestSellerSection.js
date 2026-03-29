const mongoose = require('mongoose');

const bestSellerSectionSchema = new mongoose.Schema({
  isActive: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Best Seller'
  },
  subtitle: {
    type: String,
    default: 'Take a look at our best selling products'
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

/**
 * Get the singleton config document.
 * Creates one with defaults if none exists.
 */
bestSellerSectionSchema.statics.getConfig = async function () {
  let config = await this.findOne()
    .populate({
      path: 'products',
      select: 'name slug sellingPrice basePrice offerPrice isOnOffer stockQuantity images shortDescription',
      populate: {
        path: 'images'
      }
    });
  if (!config) {
    config = await this.create({});
  }
  return config;
};

const BestSellerSection = mongoose.model('BestSellerSection', bestSellerSectionSchema);

module.exports = BestSellerSection;
