const Coupon = require('../../models/Coupon');
const AdminActivity = require('../../models/AdminActivity');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');

// @desc    Get all coupons
// @route   GET /api/v1/admin/coupons
// @access  Private/Admin
exports.getAllCoupons = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Coupon.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const coupons = await features.query
    .populate('createdBy', 'firstName lastName')
    .populate('applicableCategories', 'name')
    .populate('applicableProducts', 'name')
    .populate('excludedProducts', 'name')
    .sort('-createdAt');
  
  const total = await Coupon.countDocuments(features.filterQuery);
  
  res.status(200).json({
    status: 'success',
    results: coupons.length,
    total,
    data: {
      coupons
    }
  });
});

// @desc    Get single coupon
// @route   GET /api/v1/admin/coupons/:id
// @access  Private/Admin
exports.getCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id)
    .populate('createdBy', 'firstName lastName')
    .populate('applicableCategories', 'name')
    .populate('applicableProducts', 'name')
    .populate('excludedProducts', 'name');
  
  if (!coupon) {
    return next(new AppError('Coupon not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      coupon
    }
  });
});

// @desc    Create coupon
// @route   POST /api/v1/admin/coupons
// @access  Private/Admin
exports.createCoupon = catchAsync(async (req, res, next) => {
  // Check if coupon code already exists
  const existingCoupon = await Coupon.findOne({ code: req.body.code.toUpperCase() });
  if (existingCoupon) {
    return next(new AppError('Coupon code already exists', 400));
  }
  
  // Set createdBy
  req.body.createdBy = req.user.id;
  req.body.code = req.body.code.toUpperCase();
  
  const coupon = await Coupon.create(req.body);
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'create',
    entityType: 'Coupon',
    entityId: coupon._id,
    newState: coupon.toObject(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      coupon
    }
  });
});

// @desc    Update coupon
// @route   PATCH /api/v1/admin/coupons/:id
// @access  Private/Admin
exports.updateCoupon = catchAsync(async (req, res, next) => {
  // Get previous state
  const previousCoupon = await Coupon.findById(req.params.id);
  if (!previousCoupon) {
    return next(new AppError('Coupon not found', 404));
  }
  
  // Check if coupon code already exists (if being updated)
  if (req.body.code) {
    req.body.code = req.body.code.toUpperCase();
    const existingCoupon = await Coupon.findOne({
      code: req.body.code,
      _id: { $ne: req.params.id }
    });
    
    if (existingCoupon) {
      return next(new AppError('Coupon code already exists', 400));
    }
  }
  
  const coupon = await Coupon.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'Coupon',
    entityId: coupon._id,
    previousState: previousCoupon.toObject(),
    newState: coupon.toObject(),
    changes: req.body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      coupon
    }
  });
});

// @desc    Delete coupon
// @route   DELETE /api/v1/admin/coupons/:id
// @access  Private/Admin
exports.deleteCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);
  
  if (!coupon) {
    return next(new AppError('Coupon not found', 404));
  }
  
  // Soft delete - set isActive to false
  coupon.isActive = false;
  await coupon.save();
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'delete',
    entityType: 'Coupon',
    entityId: coupon._id,
    previousState: coupon.toObject(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Validate coupon
// @route   POST /api/v1/admin/coupons/validate
// @access  Private/Admin
exports.validateCoupon = catchAsync(async (req, res, next) => {
  const { code, cartTotal, userId, productIds } = req.body;
  
  if (!code) {
    return next(new AppError('Coupon code is required', 400));
  }
  
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon) {
    return next(new AppError('Invalid coupon code', 400));
  }
  
  const validation = coupon.validateCoupon(cartTotal || 0, userId, productIds);
  
  res.status(200).json({
    status: 'success',
    data: {
      isValid: validation.isValid,
      message: validation.message,
      discountAmount: validation.discountAmount,
      coupon: {
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minPurchaseAmount: coupon.minPurchaseAmount,
        maxDiscountAmount: coupon.maxDiscountAmount
      }
    }
  });
});

// @desc    Get coupon usage statistics
// @route   GET /api/v1/admin/coupons/:id/usage
// @access  Private/Admin
exports.getCouponUsage = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);
  
  if (!coupon) {
    return next(new AppError('Coupon not found', 404));
  }
  
  // In a real implementation, you would query orders that used this coupon
  // For now, return basic usage stats
  
  const usageStats = {
    totalUsed: coupon.usedCount,
    remainingUses: coupon.usageLimit ? coupon.usageLimit - coupon.usedCount : 'Unlimited',
    validity: coupon.isValid ? 'Valid' : 'Invalid',
    validityPeriod: coupon.formattedValidity
  };
  
  res.status(200).json({
    status: 'success',
    data: {
      coupon,
      usageStats
    }
  });
});