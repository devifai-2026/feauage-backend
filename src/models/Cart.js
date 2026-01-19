const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    unique: true
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
cartSchema.index({ user: 1 }, { unique: true });
cartSchema.index({ lastUpdated: -1 });

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