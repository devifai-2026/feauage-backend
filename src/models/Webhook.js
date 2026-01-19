const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  type: {
    type: String,
    required: [true, 'Webhook type is required'],
    enum: ['razorpay', 'shiprocket']
  },
  event: {
    type: String,
    required: [true, 'Event is required']
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Payload is required']
  },
  processed: {
    type: Boolean,
    default: false
  },
  processedAt: Date,
  error: {
    message: String,
    stack: String
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0
  },
  nextRetryAt: Date,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
webhookSchema.index({ type: 1, event: 1, createdAt: -1 });
webhookSchema.index({ order: 1 });
webhookSchema.index({ processed: 1, nextRetryAt: 1 });
webhookSchema.index({ createdAt: -1 });

// Virtual for formatted date
webhookSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
});

// Method to mark as processed
webhookSchema.methods.markAsProcessed = async function() {
  this.processed = true;
  this.processedAt = new Date();
  await this.save();
  return this;
};

// Method to mark as failed
webhookSchema.methods.markAsFailed = async function(error, retryAfterMinutes = 5) {
  this.error = {
    message: error.message,
    stack: error.stack
  };
  this.attempts += 1;
  this.nextRetryAt = new Date(Date.now() + retryAfterMinutes * 60 * 1000);
  await this.save();
  return this;
};

// Static method to get pending webhooks
webhookSchema.statics.getPendingWebhooks = async function(limit = 50) {
  const now = new Date();
  
  return this.find({
    $or: [
      { processed: false, nextRetryAt: { $lte: now } },
      { processed: false, nextRetryAt: null }
    ]
  })
  .sort({ createdAt: 1 })
  .limit(limit)
  .populate('order', 'orderId status');
};

const Webhook = mongoose.model('Webhook', webhookSchema);

module.exports = Webhook;