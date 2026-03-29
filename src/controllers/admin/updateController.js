const Update = require('../../models/Update');
const AdminActivity = require('../../models/AdminActivity');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');

// @desc    Get all updates
// @route   GET /api/v1/admin/updates
// @access  Private/Admin
exports.getAllUpdates = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Update.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const updates = await features.query
    .populate('createdBy', 'firstName lastName')
    .sort('displayOrder');

  const total = await Update.countDocuments(features.filterQuery);

  res.status(200).json({
    status: 'success',
    results: updates.length,
    total,
    data: {
      updates
    }
  });
});

// @desc    Get single update
// @route   GET /api/v1/admin/updates/:id
// @access  Private/Admin
exports.getUpdate = catchAsync(async (req, res, next) => {
  const update = await Update.findById(req.params.id)
    .populate('createdBy', 'firstName lastName');

  if (!update) {
    return next(new AppError('Update not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      update
    }
  });
});

// @desc    Create update
// @route   POST /api/v1/admin/updates
// @access  Private/Admin
exports.createUpdate = catchAsync(async (req, res, next) => {
  req.body.createdBy = req.user.id;

  const update = await Update.create(req.body);

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'create',
    entityType: 'Update',
    entityId: update._id,
    changes: req.body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(201).json({
    status: 'success',
    data: {
      update
    }
  });
});

// @desc    Update an update
// @route   PATCH /api/v1/admin/updates/:id
// @access  Private/Admin
exports.updateUpdate = catchAsync(async (req, res, next) => {
  const update = await Update.findById(req.params.id);

  if (!update) {
    return next(new AppError('Update not found', 404));
  }

  const previousState = update.toObject();

  Object.assign(update, req.body);
  await update.save();

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'Update',
    entityId: update._id,
    previousState,
    newState: update.toObject(),
    changes: req.body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(200).json({
    status: 'success',
    data: {
      update
    }
  });
});

// @desc    Delete update
// @route   DELETE /api/v1/admin/updates/:id
// @access  Private/Admin
exports.deleteUpdate = catchAsync(async (req, res, next) => {
  const update = await Update.findById(req.params.id);

  if (!update) {
    return next(new AppError('Update not found', 404));
  }

  await update.deleteOne();

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'delete',
    entityType: 'Update',
    entityId: update._id,
    previousState: update.toObject(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(204).json({
    status: 'success',
    data: null
  });
});
