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
        standardShippingCharge: settings.standardShippingCharge,
        // Storefront reads these to decide which product-page tabs to render.
        productTabs: settings.productTabs,
        // Homepage services strip + FAQ accordion, both admin-managed.
        // Disabled items are filtered out here so the storefront can render
        // whatever it receives without re-checking flags.
        serviceHighlightsEnabled: settings.serviceHighlightsEnabled,
        serviceHighlights: (settings.serviceHighlights || [])
          .filter((s) => s.enabled)
          .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)),
        faqsEnabled: settings.faqsEnabled,
        faqTitle: settings.faqTitle,
        faqs: (settings.faqs || [])
          .filter((f) => f.enabled)
          .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)),
        // About page "Our Journey" copy.
        aboutJourney: settings.aboutJourney,
        aboutCraftsmanship: settings.aboutCraftsmanship,
        aboutValues: settings.aboutValues,
        aboutCta: settings.aboutCta
      }
    }
  });
});
