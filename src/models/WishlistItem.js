const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
  wishlist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wishlist',
    required: [true, 'Wishlist is required']
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
wishlistItemSchema.index({ wishlist: 1, product: 1 }, { unique: true });
wishlistItemSchema.index({ wishlist: 1 });
wishlistItemSchema.index({ product: 1 });
wishlistItemSchema.index({ addedAt: -1 });

// Pre-save middleware to update wishlist timestamp
wishlistItemSchema.pre('save', async function(next) {
  await mongoose.model('Wishlist').findByIdAndUpdate(this.wishlist, {
    updatedAt: Date.now()
  });
  next();
});

const WishlistItem = mongoose.model('WishlistItem', wishlistItemSchema);

module.exports = WishlistItem;