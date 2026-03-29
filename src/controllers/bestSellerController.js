const BestSellerSection = require('../models/BestSellerSection');
const catchAsync = require('../utils/catchAsync');

// @desc    Get best seller section (public)
// @route   GET /api/v1/best-sellers
// @access  Public
exports.getBestSellerSection = catchAsync(async (req, res, next) => {
  const config = await BestSellerSection.getConfig();

  if (!config.isActive) {
    return res.status(200).json({
      status: 'success',
      data: { bestSeller: null }
    });
  }

  res.status(200).json({
    status: 'success',
    data: { bestSeller: config }
  });
});
