const FeaturedSection = require('../models/FeaturedSection');
const catchAsync = require('../utils/catchAsync');

// @desc    Get featured section (public)
// @route   GET /api/v1/featured
// @access  Public
exports.getFeaturedSection = catchAsync(async (req, res, next) => {
  const config = await FeaturedSection.getConfig();

  if (!config.isActive) {
    return res.status(200).json({
      status: 'success',
      data: { featured: null }
    });
  }

  res.status(200).json({
    status: 'success',
    data: { featured: config }
  });
});
