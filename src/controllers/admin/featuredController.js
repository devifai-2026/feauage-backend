const FeaturedSection = require('../../models/FeaturedSection');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

// @desc    Get featured section config
// @route   GET /api/v1/admin/featured-config
// @access  Private/Admin
exports.getConfig = catchAsync(async (req, res, next) => {
  const config = await FeaturedSection.getConfig();

  res.status(200).json({
    status: 'success',
    data: { featured: config }
  });
});

// @desc    Update featured section config
// @route   PATCH /api/v1/admin/featured-config
// @access  Private/Admin
exports.updateConfig = catchAsync(async (req, res, next) => {
  const allowedFields = ['isActive', 'title', 'subtitle', 'products'];

  const updates = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  updates.updatedBy = req.user.id;

  let config = await FeaturedSection.getConfig();
  Object.assign(config, updates);
  await config.save();

  // Re-fetch with populated products
  config = await FeaturedSection.getConfig();

  res.status(200).json({
    status: 'success',
    data: { featured: config }
  });
});
