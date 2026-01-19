const mongoose = require('mongoose');

const orderAddressSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order is required']
  },
  type: {
    type: String,
    enum: ['shipping', 'billing'],
    required: [true, 'Address type is required']
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: 'Phone number must be 10 digits'
    }
  },
  addressLine1: {
    type: String,
    required: [true, 'Address line 1 is required'],
    trim: true
  },
  addressLine2: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  pincode: {
    type: String,
    required: [true, 'Pincode is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[1-9][0-9]{5}$/.test(v);
      },
      message: 'Please provide a valid Indian pincode'
    }
  },
  country: {
    type: String,
    default: 'India',
    trim: true
  },
  landmark: String,
  email: {
    type: String,
    trim: true,
    lowercase: true
  }
}, {
  timestamps: true
});

// Indexes
orderAddressSchema.index({ order: 1, type: 1 }, { unique: true });
orderAddressSchema.index({ order: 1 });
orderAddressSchema.index({ pincode: 1 });
orderAddressSchema.index({ city: 1 });
orderAddressSchema.index({ state: 1 });

// Virtual for formatted address
orderAddressSchema.virtual('formattedAddress').get(function() {
  const parts = [
    this.name,
    this.addressLine1,
    this.addressLine2,
    `${this.city}, ${this.state} - ${this.pincode}`,
    this.country,
    this.landmark ? `Landmark: ${this.landmark}` : null,
    `Phone: ${this.phone}`,
    this.email ? `Email: ${this.email}` : null
  ].filter(Boolean);
  
  return parts.join('\n');
});

const OrderAddress = mongoose.model('OrderAddress', orderAddressSchema);

module.exports = OrderAddress;