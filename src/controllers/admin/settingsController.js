const Settings = require('../../models/Settings');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

// @desc    Get current settings
// @route   GET /api/v1/admin/settings
// @access  Private/Admin
exports.getSettings = catchAsync(async (req, res, next) => {
  const settings = await Settings.getSettings();

  res.status(200).json({
    status: 'success',
    data: { settings }
  });
});

// @desc    Update settings
// @route   PATCH /api/v1/admin/settings
// @access  Private/Admin
exports.updateSettings = catchAsync(async (req, res, next) => {
  const allowedFields = [
    'gstRate',
    'cgstRate',
    'sgstRate',
    'freeShippingThreshold',
    'metroShippingCharge',
    'standardShippingCharge',
    'metroPincodes',
    'productTabs',
    'serviceHighlights',
    'serviceHighlightsEnabled',
    'faqs',
    'faqTitle',
    'faqsEnabled',
    'aboutJourney',
    'aboutCraftsmanship',
    'aboutValues',
    'aboutCta'
  ];

  const updates = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  // The storefront needs at least one tab; description is the guaranteed one,
  // so ignore any attempt to disable it rather than rendering an empty panel.
  if (updates.productTabs?.description) {
    updates.productTabs.description.enabled = true;
  }

  updates.updatedBy = req.user.id;

  let settings = await Settings.getSettings();
  Object.assign(settings, updates);
  await settings.save();

  res.status(200).json({
    status: 'success',
    data: { settings }
  });
});
