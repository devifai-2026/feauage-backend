const mongoose = require('mongoose');

const featuredSectionSchema = new mongoose.Schema({
  isActive: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Featured Collection'
  },
  subtitle: {
    type: String,
    default: ''
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
featuredSectionSchema.statics.getConfig = async function () {
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

const FeaturedSection = mongoose.model('FeaturedSection', featuredSectionSchema);

module.exports = FeaturedSection;
