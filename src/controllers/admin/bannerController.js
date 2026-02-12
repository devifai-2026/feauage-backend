const Banner = require('../../models/Banner');
const PromoCode = require('../../models/PromoCode');
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
  req.body.createdBy = req.user.id;

  const banner = await Banner.create(req.body);
  
  // Automatically create/update promo code if provided
  if (req.body.promoCode) {
    const promoCodeStr = req.body.promoCode.toUpperCase().trim();
    
    // Check if this promo code is already used by another banner/promo
    const existingPromo = await PromoCode.findOne({ code: promoCodeStr });
    if (existingPromo && existingPromo.referenceId?.toString() !== banner._id.toString()) {
      // If we already have this code but it belongs to someone else
      return next(new AppError('This promo code is already in use by another banner or promotion.', 400));
    }

    await PromoCode.findOneAndUpdate(
      { referenceId: banner._id }, // Link by banner ID
      {
        code: promoCodeStr,
        discountPercentage: Number(req.body.discountPercentage) || 0,
        isActive: true,
        isSecret: false,
        createdBy: req.user.id,
        referenceId: banner._id
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'create',
    entityType: 'Banner',
    entityId: banner._id,
    changes: req.body,
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
  const banner = await Banner.findById(req.params.id);
  if (!banner) {
    return next(new AppError('Banner not found', 404));
  }

  const previousState = banner.toObject();

  const { images, ...otherFields } = req.body;

  Object.assign(banner, otherFields);

  if (images && Array.isArray(images)) {
    banner.images = images;
  }

  await banner.save();

  // Automatically create/update promo code if provided in update
  if (req.body.promoCode) {
    const promoCodeStr = req.body.promoCode.toUpperCase().trim();

    // Check if this promo code is already used by another banner/promo
    const existingPromo = await PromoCode.findOne({ code: promoCodeStr });
    if (existingPromo && existingPromo.referenceId?.toString() !== banner._id.toString()) {
      return next(new AppError('This promo code is already in use by another banner or promotion.', 400));
    }

    await PromoCode.findOneAndUpdate(
      { referenceId: banner._id }, // Link by banner ID
      {
        code: promoCodeStr,
        discountPercentage: Number(req.body.discountPercentage) || banner.discountPercentage || 0,
        isActive: true,
        isSecret: false,
        createdBy: req.user.id,
        referenceId: banner._id
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'Banner',
    entityId: banner._id,
    previousState,
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

  // Delete associated promo code if exists
  await PromoCode.findOneAndDelete({ referenceId: banner._id });

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

  // Create new image object
  const newImage = {
    url: req.file.location, // S3 URL
    alt: req.body.alt || banner.name,
    isPrimary: req.body.isPrimary === 'true' || banner.images.length === 0,
    displayOrder: parseInt(req.body.displayOrder) || banner.images.length
  };

  // If this new image is primary, set all other images to non-primary
  if (newImage.isPrimary) {
    banner.images.forEach(img => img.isPrimary = false);
  }

  banner.images.push(newImage);
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