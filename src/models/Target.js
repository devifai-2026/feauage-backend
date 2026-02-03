const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  targetType: {
    type: String,
    enum: ['revenue', 'users', 'orders', 'conversion'],
    default: 'revenue',
    required: [true, 'Target type is required']
  },
  targetValue: {
    type: Number,
    required: [true, 'Target value is required'],
    min: [0, 'Target value cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP']
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly', 'annually', 'custom'],
    default: 'monthly',
    required: [true, 'Period is required']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    validate: {
      validator: function(value) {
        return value <= this.endDate;
      },
      message: 'Start date must be before end date'
    }
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(value) {
        return value >= this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  currentValue: {
    type: Number,
    default: 0
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'failed', 'archived'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notifications: {
    type: Boolean,
    default: true
  },
  notificationThreshold: {
    type: Number,
    default: 80,
    min: 0,
    max: 100
  },
  category: {
    type: String,
    enum: ['sales', 'marketing', 'operations', 'financial'],
    default: 'financial'
  },
  tags: [String],
  description: String,
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
targetSchema.index({ userId: 1, status: 1 });
targetSchema.index({ userId: 1, targetType: 1 });
targetSchema.index({ userId: 1, period: 1 });
targetSchema.index({ userId: 1, startDate: 1, endDate: 1 });
targetSchema.index({ status: 1 });
targetSchema.index({ isActive: 1 });
targetSchema.index({ targetType: 1 });

// Virtual for days remaining
targetSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Virtual for target achievement
targetSchema.virtual('achievementPercentage').get(function() {
  if (this.targetValue === 0) return 0;
  return Math.min(Math.round((this.currentValue / this.targetValue) * 100), 100);
});

// Virtual for isOverdue
targetSchema.virtual('isOverdue').get(function() {
  return new Date() > new Date(this.endDate) && this.status === 'active';
});

// Virtual for period label
targetSchema.virtual('periodLabel').get(function() {
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  
  switch(this.period) {
    case 'daily':
      return start.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
    case 'weekly':
      return `Week ${Math.ceil(start.getDate() / 7)} of ${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    case 'monthly':
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    case 'quarterly':
      const quarter = Math.floor(start.getMonth() / 3) + 1;
      return `Q${quarter} ${start.getFullYear()}`;
    case 'half-yearly':
      const half = start.getMonth() < 6 ? 1 : 2;
      return `H${half} ${start.getFullYear()}`;
    case 'yearly':
    case 'annually':
      return `Year ${start.getFullYear()}`;
    case 'custom':
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    default:
      return this.period;
  }
});

// Pre-save middleware to calculate progress
targetSchema.pre('save', function(next) {
  // Calculate progress percentage
  if (this.targetValue > 0) {
    this.progress = Math.min(Math.round((this.currentValue / this.targetValue) * 100), 100);
  }
  
  // Update status based on dates
  const now = new Date();
  const endDate = new Date(this.endDate);
  
  if (this.status === 'active' && now > endDate) {
    if (this.progress >= 100) {
      this.status = 'completed';
    } else {
      this.status = 'failed';
    }
  }
  
  next();
});

// Static method to get current active target
targetSchema.statics.getCurrentTarget = async function(userId, targetType = 'revenue') {
  const now = new Date();
  
  return this.findOne({
    userId,
    targetType,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    status: 'active'
  }).sort({ createdAt: -1 });
};

// Static method to get target statistics
// Static method to get target statistics
targetSchema.statics.getTargetStats = async function(userId) {
  // Convert userId to ObjectId using 'new' keyword
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  return this.aggregate([
    {
      $match: {
        userId: userObjectId,  // Use the ObjectId instance
        isActive: true
      }
    },
    {
      $group: {
        _id: '$targetType',
        totalTargets: { $sum: 1 },
        totalValue: { $sum: '$targetValue' },
        currentValue: { $sum: '$currentValue' },
        avgProgress: { $avg: '$progress' },
        completedTargets: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        },
        activeTargets: {
          $sum: {
            $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        targetType: '$_id',
        totalTargets: 1,
        totalValue: 1,
        currentValue: 1,
        avgProgress: { $round: ['$avgProgress', 2] },
        completionRate: {
          $round: [
            {
              $multiply: [
                { $divide: ['$completedTargets', '$totalTargets'] },
                100
              ]
            },
            2
          ]
        },
        activeTargets: 1,
        _id: 0
      }
    }
  ]);
};
// Instance method to update current value
targetSchema.methods.updateCurrentValue = async function(newValue) {
  this.currentValue = newValue;
  return this.save();
};

const Target = mongoose.model('Target', targetSchema);

module.exports = Target;