const Banner = require('../../models/Banner');
const AdminActivity = require('../../models/AdminActivity');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');

// @desc    Get all banners
// @route   GET /api/v1/admin/banners
// @access  Private/Admin
exports.getAllBanners = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Banner.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const banners = await features.query
    .populate('createdBy', 'firstName lastName')
    .sort('displayOrder');
  
  const total = await Banner.countDocuments(features.filterQuery);
  
  res.status(200).json({
    status: 'success',
    results: banners.length,
    total,
    data: {
      banners
    }
  });
});

// @desc    Get single banner
// @route   GET /api/v1/admin/banners/:id
// @access  Private/Admin
exports.getBanner = catchAsync(async (req, res, next) => {
  const banner = await Banner.findById(req.params.id)
    .populate('createdBy', 'firstName lastName');
  
  if (!banner) {
    return next(new AppError('Banner not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      banner
    }
  });
});

// @desc    Create banner
// @route   POST /api/v1/admin/banners
// @access  Private/Admin
exports.createBanner = catchAsync(async (req, res, next) => {
  // Set createdBy
  req.body.createdBy = req.user.id;
  
  const banner = await Banner.create(req.body);
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'create',
    entityType: 'Banner',
    entityId: banner._id,
    newState: banner.toObject(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      banner
    }
  });
});

// @desc    Update banner
// @route   PATCH /api/v1/admin/banners/:id
// @access  Private/Admin
exports.updateBanner = catchAsync(async (req, res, next) => {
  // Get previous state
  const previousBanner = await Banner.findById(req.params.id);
  if (!previousBanner) {
    return next(new AppError('Banner not found', 404));
  }
  
  const banner = await Banner.findByIdAndUpdate(
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
    entityType: 'Banner',
    entityId: banner._id,
    previousState: previousBanner.toObject(),
    newState: banner.toObject(),
    changes: req.body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      banner
    }
  });
});

// @desc    Delete banner
// @route   DELETE /api/v1/admin/banners/:id
// @access  Private/Admin
exports.deleteBanner = catchAsync(async (req, res, next) => {
  const banner = await Banner.findById(req.params.id);
  
  if (!banner) {
    return next(new AppError('Banner not found', 404));
  }
  
  await banner.deleteOne();
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'delete',
    entityType: 'Banner',
    entityId: banner._id,
    previousState: banner.toObject(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Upload banner image
// @route   POST /api/v1/admin/banners/:id/upload-image
// @access  Private/Admin
exports.uploadBannerImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload an image', 400));
  }
  
  const banner = await Banner.findById(req.params.id);
  if (!banner) {
    return next(new AppError('Banner not found', 404));
  }
  
  // Update banner image
  banner.image = req.file.location; // S3 URL
  
  if (req.body.type === 'mobile' && req.file.mimetype.includes('image')) {
    banner.mobileImage = req.file.location;
  }
  
  await banner.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      banner
    }
  });
});

// @desc    Get active banners for page
// @route   GET /api/v1/admin/banners/page/:page
// @access  Private/Admin
exports.getBannersByPage = catchAsync(async (req, res, next) => {
  const { page } = req.params;
  const { position } = req.query;
  
  const query = {
    page,
    isActive: true,
    startDate: { $lte: new Date() },
    $or: [
      { endDate: { $gte: new Date() } },
      { endDate: null }
    ]
  };
  
  if (position) {
    query.position = position;
  }
  
  const banners = await Banner.find(query)
    .sort('displayOrder');
  
  res.status(200).json({
    status: 'success',
    results: banners.length,
    data: {
      banners
    }
  });
});