const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  sku: {
    type: String,
    required: [true, 'SKU is required']
  },
  type: {
    type: String,
    enum: ['stock_in', 'stock_out', 'adjustment', 'return', 'damaged', 'transfer'],
    required: [true, 'Type is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  previousStock: {
    type: Number,
    required: [true, 'Previous stock is required']
  },
  newStock: {
    type: Number,
    required: [true, 'New stock is required']
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceType'
  },
  referenceType: {
    type: String,
    enum: ['Order', 'PurchaseOrder', 'Return', 'Adjustment', null],
    default: null
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Performed by is required']
  },
  performedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
}, {
  timestamps: true
});

// Indexes
stockHistorySchema.index({ product: 1, performedAt: -1 });
stockHistorySchema.index({ type: 1 });
stockHistorySchema.index({ sku: 1 });
stockHistorySchema.index({ performedBy: 1 });
stockHistorySchema.index({ referenceId: 1, referenceType: 1 });
stockHistorySchema.index({ createdAt: -1 });

// Virtual for formatted date
stockHistorySchema.virtual('formattedDate').get(function() {
  return this.performedAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Pre-save middleware
stockHistorySchema.pre('save', function(next) {
  if (this.isNew) {
    this.performedAt = Date.now();
  }
  next();
});

const StockHistory = mongoose.model('StockHistory', stockHistorySchema);

module.exports = StockHistory;