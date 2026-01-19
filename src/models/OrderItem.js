const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order is required']
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  sku: {
    type: String,
    required: [true, 'SKU is required']
  },
  productName: {
    type: String,
    required: [true, 'Product name is required']
  },
  productImage: String,
  discount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes
orderItemSchema.index({ order: 1 });
orderItemSchema.index({ product: 1 });
orderItemSchema.index({ sku: 1 });

// Virtual for total price
orderItemSchema.virtual('total').get(function() {
  return this.price * this.quantity;
});

// Virtual for total with discount
orderItemSchema.virtual('totalAfterDiscount').get(function() {
  return (this.price - this.discount) * this.quantity;
});

const OrderItem = mongoose.model('OrderItem', orderItemSchema);

module.exports = OrderItem;