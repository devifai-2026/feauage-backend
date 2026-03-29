const Update = require('../models/Update');
const catchAsync = require('../utils/catchAsync');

// @desc    Get active updates
// @route   GET /api/v1/updates
// @access  Public
exports.getActiveUpdates = catchAsync(async (req, res, next) => {
  const updates = await Update.find({ isActive: true })
    .sort({ displayOrder: 1, publishDate: -1 })
    .limit(10)
    .select('-createdBy -__v');

  res.status(200).json({
    status: 'success',
    results: updates.length,
    data: {
      updates
    }
  });
});
