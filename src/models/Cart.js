const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    sparse: true
  },
  guestId: {
    type: String,
    required: false,
    index: true,
    sparse: true
  },
  items: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CartItem'
  }],
  cartTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  discountTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  couponApplied: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
// cartSchema.index({ user: 1 }, { unique: true, sparse: true });
cartSchema.index({ guestId: 1 }, { unique: true, sparse: true });
cartSchema.index({ lastUpdated: -1 });

// Clean up problematic index if it exists
try {
  // Wait for connection to be ready
  setTimeout(async () => {
    try {
      const CartModel = mongoose.model('Cart');
      await CartModel.collection.dropIndex('user_1');
      console.log('-------------------------------------------');
      console.log('!!! FIXED: DROPPED user_1 INDEX SUCCESS !!!');
      console.log('-------------------------------------------');
    } catch (e) {
       // console.log('Index drop info:', e.message);
    }
  }, 5000);
} catch (e) {}

// Virtual for item count
cartSchema.virtual('itemCount').get(function() {
  return this.items.length;
});

// Method to calculate totals
cartSchema.methods.calculateTotals = async function() {
  const CartItem = mongoose.model('CartItem');
  
  const cartItems = await CartItem.find({ _id: { $in: this.items } })
    .populate('product', 'sellingPrice offerPrice isOnOffer stockQuantity stockStatus');
  
  let cartTotal = 0;
  let discountTotal = 0;
  
  for (const item of cartItems) {
    if (!item.product) {
      // Product might have been deleted
      continue;
    }
    const product = item.product;
    const price = product.isOnOffer ? product.offerPrice : product.sellingPrice;
    const itemTotal = price * item.quantity;
    
    cartTotal += itemTotal;
    discountTotal += (product.sellingPrice - price) * item.quantity;
  }
  
  this.cartTotal = cartTotal;
  this.discountTotal = discountTotal;
  this.grandTotal = cartTotal;
  this.lastUpdated = Date.now();
  
  await this.save();
  
  return {
    cartTotal: this.cartTotal,
    discountTotal: this.discountTotal,
    grandTotal: this.grandTotal,
    itemCount: this.items.length
  };
};

// Method to clear cart
cartSchema.methods.clearCart = async function() {
  const CartItem = mongoose.model('CartItem');
  
  await CartItem.deleteMany({ _id: { $in: this.items } });
  
  this.items = [];
  this.cartTotal = 0;
  this.discountTotal = 0;
  this.grandTotal = 0;
  this.couponApplied = null;
  this.lastUpdated = Date.now();
  
  await this.save();
  
  return this;
};

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;