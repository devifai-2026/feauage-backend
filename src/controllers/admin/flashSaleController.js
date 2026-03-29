const FlashSale = require('../../models/FlashSale');
const AdminActivity = require('../../models/AdminActivity');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');

// @desc    Get all flash sales
// @route   GET /api/v1/admin/flash-sales
// @access  Private/Admin
exports.getAllFlashSales = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(FlashSale.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const flashSales = await features.query
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  const total = await FlashSale.countDocuments(features.filterQuery);

  res.status(200).json({
    status: 'success',
    results: flashSales.length,
    total,
    data: {
      flashSales
    }
  });
});

// @desc    Get single flash sale
// @route   GET /api/v1/admin/flash-sales/:id
// @access  Private/Admin
exports.getFlashSale = catchAsync(async (req, res, next) => {
  const flashSale = await FlashSale.findById(req.params.id)
    .populate('createdBy', 'firstName lastName');

  if (!flashSale) {
    return next(new AppError('Flash sale not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      flashSale
    }
  });
});

// @desc    Create flash sale
// @route   POST /api/v1/admin/flash-sales
// @access  Private/Admin
exports.createFlashSale = catchAsync(async (req, res, next) => {
  req.body.createdBy = req.user.id;

  const flashSale = await FlashSale.create(req.body);

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'create',
    entityType: 'FlashSale',
    entityId: flashSale._id,
    changes: req.body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(201).json({
    status: 'success',
    data: {
      flashSale
    }
  });
});

// @desc    Update flash sale
// @route   PATCH /api/v1/admin/flash-sales/:id
// @access  Private/Admin
exports.updateFlashSale = catchAsync(async (req, res, next) => {
  const flashSale = await FlashSale.findById(req.params.id);

  if (!flashSale) {
    return next(new AppError('Flash sale not found', 404));
  }

  const previousState = flashSale.toObject();

  Object.assign(flashSale, req.body);
  await flashSale.save();

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'FlashSale',
    entityId: flashSale._id,
    previousState,
    newState: flashSale.toObject(),
    changes: req.body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(200).json({
    status: 'success',
    data: {
      flashSale
    }
  });
});

// @desc    Delete flash sale
// @route   DELETE /api/v1/admin/flash-sales/:id
// @access  Private/Admin
exports.deleteFlashSale = catchAsync(async (req, res, next) => {
  const flashSale = await FlashSale.findById(req.params.id);

  if (!flashSale) {
    return next(new AppError('Flash sale not found', 404));
  }

  await flashSale.deleteOne();

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'delete',
    entityType: 'FlashSale',
    entityId: flashSale._id,
    previousState: flashSale.toObject(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(204).json({
    status: 'success',
    data: null
  });
});
