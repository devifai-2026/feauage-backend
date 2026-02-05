const PromoCode = require('../../models/PromoCode');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

// @desc    Get all promo codes (Admin)
exports.getAllPromoCodes = catchAsync(async (req, res, next) => {
  const promoCodes = await PromoCode.find().sort('-createdAt');
  
  res.status(200).json({
    status: 'success',
    results: promoCodes.length,
    data: {
      promoCodes
    }
  });
});

// @desc    Get active promo codes (Client)
exports.getActivePromoCodes = catchAsync(async (req, res, next) => {
  const promoCodes = await PromoCode.find({ isActive: true, isSecret: { $ne: true } }).select('code discountPercentage');
  
  res.status(200).json({
    status: 'success',
    results: promoCodes.length,
    data: {
      promoCodes
    }
  });
});

// @desc    Create promo code
exports.createPromoCode = catchAsync(async (req, res, next) => {
  // Check count limit
  const count = await PromoCode.countDocuments();
  if (count >= 10) {
    return next(new AppError('Maximum limit of 10 promo codes reached.', 400));
  }

  const promoCode = await PromoCode.create({
    ...req.body,
    createdBy: req.user.id
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      promoCode
    }
  });
});

// @desc    Update promo code
exports.updatePromoCode = catchAsync(async (req, res, next) => {
  const promoCode = await PromoCode.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  if (!promoCode) {
    return next(new AppError('Promo code not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      promoCode
    }
  });
});

// @desc    Delete promo code
exports.deletePromoCode = catchAsync(async (req, res, next) => {
  const promoCode = await PromoCode.findByIdAndDelete(req.params.id);
  
  if (!promoCode) {
    return next(new AppError('Promo code not found', 404));
  }
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Validate promo code
exports.validatePromoCode = catchAsync(async (req, res, next) => {
  const { code } = req.body;
  
  if (!code) {
    return next(new AppError('Promo code is required', 400));
  }
  
  const promoCode = await PromoCode.findOne({ code: code.toUpperCase(), isActive: true });
  
  if (!promoCode) {
    return next(new AppError('Invalid or inactive promo code', 400));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      promoCode: {
        code: promoCode.code,
        discountPercentage: promoCode.discountPercentage
      }
    }
  });
});
