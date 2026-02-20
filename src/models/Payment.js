const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  id: String,
  name: String,
  last4: String,
  network: String,       // Visa, Mastercard, etc.
  type: String,          // debit, credit, prepaid
  issuer: String,
  international: Boolean,
  emi: Boolean,
  subType: String,
  tokenIin: String
}, { _id: false });

const acquirerDataSchema = new mongoose.Schema({
  authCode: String,
  rrn: String,
  upiTransactionId: String
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  // Link to our Order
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Razorpay IDs
  razorpayPaymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  razorpayOrderId: {
    type: String,
    index: true
  },
  razorpayCustomerId: String,
  razorpayTokenId: String,

  // Amount
  amount: {
    type: Number,   // in paise (smallest currency unit)
    required: true
  },
  amountRefunded: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },

  // Status
  status: {
    type: String,
    enum: ['created', 'authorized', 'captured', 'refunded', 'failed'],
    required: true
  },
  captured: {
    type: Boolean,
    default: false
  },
  refundStatus: {
    type: String,
    enum: ['null', 'partial', 'full', null],
    default: null
  },

  // Payment method details
  method: {
    type: String,
    enum: ['card', 'netbanking', 'wallet', 'emi', 'upi', 'paylater', 'cod', 'razorpay'],
    required: true
  },
  international: {
    type: Boolean,
    default: false
  },

  // Card details (for card payments)
  card: cardSchema,
  cardId: String,

  // UPI
  vpa: String,

  // Netbanking
  bank: String,

  // Wallet
  wallet: String,

  // Contact info
  email: String,
  contact: String,

  // Fee breakdown
  fee: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },

  // Acquirer data
  acquirerData: acquirerDataSchema,

  // Error details
  errorCode: String,
  errorDescription: String,
  errorSource: String,
  errorStep: String,
  errorReason: String,

  description: String,

  // Full raw response from Razorpay (for debugging/audit)
  rawResponse: {
    type: mongoose.Schema.Types.Mixed
  },

  // Razorpay created_at (Unix timestamp from Razorpay)
  razorpayCreatedAt: Number
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: amount in rupees
paymentSchema.virtual('amountInRupees').get(function () {
  return this.amount / 100;
});

paymentSchema.virtual('amountRefundedInRupees').get(function () {
  return this.amountRefunded / 100;
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
