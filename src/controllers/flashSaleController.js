const FlashSale = require('../models/FlashSale');
const catchAsync = require('../utils/catchAsync');

// @desc    Get active flash sale
// @route   GET /api/v1/flash-sale
// @access  Public
exports.getActiveFlashSale = catchAsync(async (req, res, next) => {
  const flashSale = await FlashSale.getActiveFlashSale();

  res.status(200).json({
    status: 'success',
    data: {
      flashSale
    }
  });
});
