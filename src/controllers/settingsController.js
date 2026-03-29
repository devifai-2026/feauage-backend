const Settings = require('../models/Settings');
const catchAsync = require('../utils/catchAsync');

// @desc    Get public settings (for frontend display)
// @route   GET /api/v1/settings
// @access  Public
exports.getPublicSettings = catchAsync(async (req, res, next) => {
  const settings = await Settings.getSettings();

  res.status(200).json({
    status: 'success',
    data: {
      settings: {
        gstRate: settings.gstRate,
        freeShippingThreshold: settings.freeShippingThreshold,
        metroShippingCharge: settings.metroShippingCharge,
        standardShippingCharge: settings.standardShippingCharge
      }
    }
  });
});
