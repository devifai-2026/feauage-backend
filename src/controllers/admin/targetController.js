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
      case 'half-yearly':
        end.setMonth(end.getMonth() + 6);
        break;
      case 'yearly':
      case 'annually':
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
  const { period = 'monthly' } = req.query;
  const now = new Date();
  let startDate, endDate, lastPeriodStart, lastPeriodEnd;
  // Convert to IST timezone (UTC+5:30)
  const nowIST = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  
  const istYear = nowIST.getUTCFullYear();
  const istMonth = nowIST.getUTCMonth();

  if (period === 'monthly') {
    startDate = new Date(Date.UTC(istYear, istMonth, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(istYear, istMonth + 1, 0, 23, 59, 59, 999));
    lastPeriodStart = new Date(Date.UTC(istYear, istMonth - 1, 1, 0, 0, 0, 0));
    lastPeriodEnd = new Date(Date.UTC(istYear, istMonth, 0, 23, 59, 59, 999));
  } else if (period === 'quarterly') {
    const quarter = Math.floor(istMonth / 3);
    startDate = new Date(Date.UTC(istYear, quarter * 3, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(istYear, (quarter + 1) * 3, 0, 23, 59, 59, 999));
    lastPeriodStart = new Date(Date.UTC(istYear, (quarter - 1) * 3, 1, 0, 0, 0, 0));
    lastPeriodEnd = new Date(Date.UTC(istYear, quarter * 3, 0, 23, 59, 59, 999));
  } else if (period === 'half-yearly') {
    const half = istMonth < 6 ? 0 : 6;
    startDate = new Date(Date.UTC(istYear, half, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(istYear, half + 6, 0, 23, 59, 59, 999));
    lastPeriodStart = new Date(Date.UTC(istYear, half - 6, 1, 0, 0, 0, 0));
    lastPeriodEnd = new Date(Date.UTC(istYear, half, 0, 23, 59, 59, 999));
  } else if (period === 'annually' || period === 'yearly') {
    startDate = new Date(Date.UTC(istYear, 0, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(istYear, 12, 0, 23, 59, 59, 999));
    lastPeriodStart = new Date(Date.UTC(istYear - 1, 0, 1, 0, 0, 0, 0));
    lastPeriodEnd = new Date(Date.UTC(istYear - 1, 12, 0, 23, 59, 59, 999));
  }

  // Get current period's revenue target
  const target = await Target.findOne({
    userId: req.user.id,
    targetType: 'revenue',
    period: period,
    isActive: true,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate }
  }).sort({ createdAt: -1 });

  // Get last period's target for comparison
  const lastTarget = await Target.findOne({
    userId: req.user.id,
    targetType: 'revenue',
    period: period,
    isActive: false,
    startDate: { $gte: lastPeriodStart, $lte: lastPeriodEnd }
  }).sort({ createdAt: -1 });

  // Calculate today's earnings (actual calculation from orders)
  const Order = mongoose.model('Order');
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dailyRevenue = await Order.aggregate([
    {
      $match: {
        status: 'delivered',
        createdAt: { $gte: startOfToday }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$grandTotal' }
      }
    }
  ]);
  
  const todayEarnings = dailyRevenue[0]?.total || 0;

  // Calculate days elapsed/remaining based on exactly what day of the month it currently is in IST
  // We use dates stripped of hours/minutes so differences are exactly N days
  const rawStart = new Date(startDate);
  const startStr = new Date(rawStart.getTime() + (5.5 * 60 * 60 * 1000));
  const rawEnd = new Date(endDate);
  const endStr = new Date(rawEnd.getTime() + (5.5 * 60 * 60 * 1000));
  
  const startNormalized = new Date(Date.UTC(startStr.getUTCFullYear(), startStr.getUTCMonth(), startStr.getUTCDate()));
  const endNormalized = new Date(Date.UTC(endStr.getUTCFullYear(), endStr.getUTCMonth(), endStr.getUTCDate()));
  const nowNormalized = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()));

  const totalDays = Math.round((endNormalized - startNormalized) / (1000 * 60 * 60 * 24)) + 1; 
  const daysElapsed = Math.round((nowNormalized - startNormalized) / (1000 * 60 * 60 * 24)) + 1;
  const daysRemaining = Math.max(0, totalDays - daysElapsed);

  const response = {
    hasTarget: !!target,
    target: target || null,
    progress: target ? target.progress : 0,
    todayEarnings,
    increaseFromLastMonth: lastTarget ? 
      ((target?.progress || 0) - lastTarget.progress) : 0,
    remaining: target ? 
      Math.max(0, target.targetValue - target.currentValue) : 0,
    currentEarnings: target ? target.currentValue : 0,
    daysElapsed: {
      total: totalDays,
      elapsed: daysElapsed,
      remaining: daysRemaining
    },
    period: period
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