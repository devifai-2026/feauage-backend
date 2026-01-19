const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    unique: true
  },
  items: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WishlistItem'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
wishlistSchema.index({ user: 1 }, { unique: true });
wishlistSchema.index({ updatedAt: -1 });

// Virtual for item count
wishlistSchema.virtual('itemCount').get(function() {
  return this.items.length;
});

// Method to add item to wishlist
wishlistSchema.methods.addItem = async function(productId) {
  const WishlistItem = mongoose.model('WishlistItem');
  
  // Check if item already exists
  const existingItem = await WishlistItem.findOne({
    wishlist: this._id,
    product: productId
  });
  
  if (existingItem) {
    throw new Error('Product already in wishlist');
  }
  
  // Create new wishlist item
  const wishlistItem = await WishlistItem.create({
    wishlist: this._id,
    product: productId
  });
  
  // Add to items array
  this.items.push(wishlistItem._id);
  await this.save();
  
  return wishlistItem;
};

// Method to remove item from wishlist
wishlistSchema.methods.removeItem = async function(productId) {
  const WishlistItem = mongoose.model('WishlistItem');
  
  // Find and remove the item
  const wishlistItem = await WishlistItem.findOneAndDelete({
    wishlist: this._id,
    product: productId
  });
  
  if (wishlistItem) {
    // Remove from items array
    this.items = this.items.filter(
      itemId => itemId.toString() !== wishlistItem._id.toString()
    );
    await this.save();
  }
  
  return wishlistItem;
};

// Method to clear wishlist
wishlistSchema.methods.clearWishlist = async function() {
  const WishlistItem = mongoose.model('WishlistItem');
  
  await WishlistItem.deleteMany({ wishlist: this._id });
  
  this.items = [];
  await this.save();
  
  return this;
};

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;