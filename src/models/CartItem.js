const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart',
    required: [true, 'Cart is required']
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
cartItemSchema.index({ cart: 1, product: 1 }, { unique: true });
cartItemSchema.index({ cart: 1 });
cartItemSchema.index({ product: 1 });
cartItemSchema.index({ addedAt: -1 });

// Virtual for total price
cartItemSchema.virtual('total').get(function() {
  return this.price * this.quantity;
});

// Pre-save middleware to update cart timestamp
cartItemSchema.pre('save', async function(next) {
  await mongoose.model('Cart').findByIdAndUpdate(this.cart, {
    lastUpdated: Date.now()
  });
  next();
});

// Post-save middleware to update cart totals
cartItemSchema.post('save', async function() {
  const cart = await mongoose.model('Cart').findById(this.cart);
  if (cart) {
    await cart.calculateTotals();
  }
});

// Post-deleteOne middleware to update cart totals
cartItemSchema.post('deleteOne', { document: true, query: false }, async function() {
  const cart = await mongoose.model('Cart').findById(this.cart);
  if (cart) {
    // Remove item from cart items array
    cart.items = cart.items.filter(itemId => itemId.toString() !== this._id.toString());
    await cart.save();
    await cart.calculateTotals();
  }
});

const CartItem = mongoose.model('CartItem', cartItemSchema);

module.exports = CartItem;