const mongoose = require('mongoose');

const adminActivitySchema = new mongoose.Schema({
  adminUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Admin user is required']
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: ['create', 'update', 'delete', 'login', 'logout', 'export', 'import', 'approve', 'reject', 'refund', 'cancel']
  },
  entityType: {
    type: String,
    required: [true, 'Entity type is required'],
    enum: ['Product', 'Category', 'Order', 'User', 'Coupon', 'Banner', 'Review', 'Stock']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'entityType'
  },
  previousState: {
    type: mongoose.Schema.Types.Mixed
  },
  newState: {
    type: mongoose.Schema.Types.Mixed
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: String,
  userAgent: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for fast queries
adminActivitySchema.index({ adminUser: 1, createdAt: -1 });
adminActivitySchema.index({ entityType: 1, entityId: 1 });
adminActivitySchema.index({ action: 1, createdAt: -1 });
adminActivitySchema.index({ createdAt: -1 });

// Virtual for formatted date
adminActivitySchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for description
adminActivitySchema.virtual('description').get(function() {
  const entityName = this.entityType.toLowerCase();
  return `${this.action}d ${entityName}`;
});

// Static method to log activity
adminActivitySchema.statics.logActivity = async function(data) {
  try {
    const activity = await this.create(data);
    return activity;
  } catch (error) {
    console.error('Failed to log admin activity:', error);
    return null;
  }
};

const AdminActivity = mongoose.model('AdminActivity', adminActivitySchema);

module.exports = AdminActivity;