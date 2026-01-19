const Target = require('../../models/Target');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');
  const mongoose = require('mongoose');
// @desc    Create a new target
// @route   POST /api/v1/targets
// @access  Private
exports.createTarget = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { targetType, startDate, endDate } = req.body;
  
  // Parse dates
  const newStartDate = new Date(startDate);
  const newEndDate = new Date(endDate || req.body.endDate);
  
  // Check for existing active target of same type and overlapping period
  const existingTarget = await Target.findOne({
    userId: userId,
    targetType: targetType,
    isActive: true,
    // Only check targets that are NOT completed
    $or: [
      { status: { $ne: 'completed' } },
      { progress: { $lt: 100 } }
    ],
    $or: [
      {
        startDate: { $lte: newEndDate },
        endDate: { $gte: newStartDate }
      }
    ]
  });

  if (existingTarget) {
    // Check if existing target is completed
    if (existingTarget.status === 'completed' && existingTarget.progress >= 100) {
      // If target is completed, deactivate it so new target can be created
      await Target.findByIdAndUpdate(existingTarget._id, {
        isActive: false,
        lastUpdatedBy: userId
      });
    } else {
      // Target exists and is not completed
      return next(new AppError(
        `You already have an active ${targetType} target for this period (${existingTarget.startDate.toLocaleDateString()} to ${existingTarget.endDate.toLocaleDateString()}). Please complete or archive the existing target first.`,
        400
      ));
    }
  }

  const targetData = {
    ...req.body,
    userId: userId,
    createdBy: userId,
    lastUpdatedBy: userId,
    // Ensure initial values
    currentValue: 0,
    progress: 0,
    status: 'active',
    isActive: true
  };

  // Auto-calculate end date for standard periods if not provided
  if (req.body.period !== 'custom' && !req.body.endDate) {
    const start = new Date(req.body.startDate || new Date());
    let end = new Date(start);
    
    switch(req.body.period) {
      case 'daily':
        end.setDate(end.getDate() + 1);
        break;
      case 'weekly':
        end.setDate(end.getDate() + 7);
        break;
      case 'monthly':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'quarterly':
        end.setMonth(end.getMonth() + 3);
        break;
      case 'yearly':
        end.setFullYear(end.getFullYear() + 1);
        break;
    }
    
    targetData.endDate = end;
  }

  // Validate that start date is before end date
  if (new Date(targetData.startDate) >= new Date(targetData.endDate)) {
    return next(new AppError('Start date must be before end date', 400));
  }

  const target = await Target.create(targetData);

  res.status(201).json({
    status: 'success',
    data: {
      target
    }
  });
});

// @desc    Get all targets
// @route   GET /api/v1/targets
// @access  Private
exports.getAllTargets = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    Target.find({ userId: req.user.id }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const targets = await features.query;

  // Get total count for pagination
  const total = await Target.countDocuments({ userId: req.user.id });

  res.status(200).json({
    status: 'success',
    results: targets.length,
    total,
    data: {
      targets
    }
  });
});

// @desc    Get target by ID
// @route   GET /api/v1/targets/:id
// @access  Private
exports.getTarget = catchAsync(async (req, res, next) => {
  const target = await Target.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!target) {
    return next(new AppError('Target not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      target
    }
  });
});

// @desc    Update target
// @route   PATCH /api/v1/targets/:id
// @access  Private
exports.updateTarget = catchAsync(async (req, res, next) => {
  const target = await Target.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!target) {
    return next(new AppError('Target not found', 404));
  }

  // Prevent updating completed targets
  if (target.status === 'completed' && req.body.status !== 'archived') {
    return next(new AppError('Cannot modify a completed target', 400));
  }

  // If updating dates, check for overlapping targets
  if (req.body.startDate || req.body.endDate) {
    const startDate = new Date(req.body.startDate || target.startDate);
    const endDate = new Date(req.body.endDate || target.endDate);
    
    const overlappingTarget = await Target.findOne({
      userId: req.user.id,
      targetType: target.targetType,
      isActive: true,
      _id: { $ne: target._id },
      $or: [
        {
          startDate: { $lte: endDate },
          endDate: { $gte: startDate }
        }
      ]
    });

    if (overlappingTarget) {
      return next(new AppError(
        `Another active ${target.targetType} target overlaps with this date range.`,
        400
      ));
    }
  }

  // Update target
  Object.keys(req.body).forEach(key => {
    if (key !== 'userId' && key !== 'createdBy') {
      target[key] = req.body[key];
    }
  });

  target.lastUpdatedBy = req.user.id;
  await target.save();

  res.status(200).json({
    status: 'success',
    data: {
      target
    }
  });
});

// @desc    Delete target
// @route   DELETE /api/v1/targets/:id
// @access  Private
exports.deleteTarget = catchAsync(async (req, res, next) => {
  const target = await Target.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!target) {
    return next(new AppError('Target not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Update target current value
// @route   PATCH /api/v1/targets/:id/update-value
// @access  Private
exports.updateTargetValue = catchAsync(async (req, res, next) => {
  const { currentValue } = req.body;
  
  if (!currentValue && currentValue !== 0) {
    return next(new AppError('Current value is required', 400));
  }

  const target = await Target.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!target) {
    return next(new AppError('Target not found', 404));
  }

  if (target.status !== 'active') {
    return next(new AppError('Cannot update value for non-active target', 400));
  }

  target.currentValue = currentValue;
  target.lastUpdatedBy = req.user.id;
  await target.save();

  res.status(200).json({
    status: 'success',
    data: {
      target
    }
  });
});

// @desc    Get current active target
// @route   GET /api/v1/targets/current
// @access  Private
exports.getCurrentTarget = catchAsync(async (req, res, next) => {
  const { type = 'revenue' } = req.query;
  
  const target = await Target.getCurrentTarget(req.user.id, type);

  res.status(200).json({
    status: 'success',
    data: {
      target
    }
  });
});

// @desc    Get target statistics
// @route   GET /api/v1/targets/stats
// @access  Private
exports.getTargetStats = catchAsync(async (req, res, next) => {

  
  // Convert userId to ObjectId
  const userObjectId = new mongoose.Types.ObjectId(req.user.id);
  
  const stats = await Target.getTargetStats(userObjectId);

  // Get total targets count
  const totalTargets = await Target.countDocuments({ 
    userId: userObjectId 
  });
  
  // Get active targets
  const activeTargets = await Target.countDocuments({
    userId: userObjectId,
    status: 'active',
    isActive: true
  });

  // Get completed targets this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const completedThisMonth = await Target.countDocuments({
    userId: userObjectId,
    status: 'completed',
    updatedAt: { $gte: startOfMonth }
  });

  res.status(200).json({
    status: 'success',
    data: {
      stats,
      summary: {
        totalTargets,
        activeTargets,
        completedThisMonth
      }
    }
  });
});

// @desc    Get monthly revenue target progress
// @route   GET /api/v1/targets/revenue/monthly
// @access  Private
exports.getMonthlyRevenueProgress = catchAsync(async (req, res, next) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get current month's revenue target
  const monthlyTarget = await Target.findOne({
    userId: req.user.id,
    targetType: 'revenue',
    period: 'monthly',
    isActive: true,
    startDate: { $lte: endOfMonth },
    endDate: { $gte: startOfMonth }
  }).sort({ createdAt: -1 });

  // Get last month's target for comparison
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const lastMonthTarget = await Target.findOne({
    userId: req.user.id,
    targetType: 'revenue',
    period: 'monthly',
    isActive: false,
    startDate: { $gte: lastMonthStart, $lte: lastMonthEnd }
  }).sort({ createdAt: -1 });

  // Calculate today's earnings (simplified - you might want to fetch from orders)
  const todayEarnings = Math.random() * 10000; // Replace with actual calculation

  const response = {
    hasTarget: !!monthlyTarget,
    target: monthlyTarget || null,
    progress: monthlyTarget ? monthlyTarget.progress : 0,
    todayEarnings,
    increaseFromLastMonth: lastMonthTarget ? 
      ((monthlyTarget?.progress || 0) - lastMonthTarget.progress) : 0,
    remaining: monthlyTarget ? 
      Math.max(0, monthlyTarget.targetValue - monthlyTarget.currentValue) : 0
  };

  res.status(200).json({
    status: 'success',
    data: response
  });
});

// @desc    Archive target
// @route   PATCH /api/v1/targets/:id/archive
// @access  Private
exports.archiveTarget = catchAsync(async (req, res, next) => {
  const target = await Target.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!target) {
    return next(new AppError('Target not found', 404));
  }

  target.isActive = false;
  target.status = 'archived';
  target.lastUpdatedBy = req.user.id;
  await target.save();

  res.status(200).json({
    status: 'success',
    data: {
      target
    }
  });
});

// @desc    Bulk archive targets
// @route   PATCH /api/v1/targets/bulk-archive
// @access  Private
exports.bulkArchiveTargets = catchAsync(async (req, res, next) => {
  const { targetIds } = req.body;

  if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
    return next(new AppError('Please provide an array of target IDs', 400));
  }

  const result = await Target.updateMany(
    {
      _id: { $in: targetIds },
      userId: req.user.id
    },
    {
      $set: {
        isActive: false,
        status: 'archived',
        lastUpdatedBy: req.user.id
      }
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      modifiedCount: result.modifiedCount
    }
  });
});