const Banner = require('../models/Banner');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// @desc    Get banners for a specific page
// @route   GET /api/v1/banners/page/:page
// @access  Public
exports.getBannersByPage = catchAsync(async (req, res, next) => {
    const { page } = req.params;
    const { position, bannerType } = req.query;

    const query = {
        page: { $in: [page, 'all'] },
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

    if (bannerType) {
        query.bannerType = bannerType;
    }

    const banners = await Banner.find(query)
        .sort('displayOrder')
        .select('-createdBy -__v');

    res.status(200).json({
        status: 'success',
        results: banners.length,
        data: {
            banners
        }
    });
});

// @desc    Get banner by name
// @route   GET /api/v1/banners/name/:name
// @access  Public
exports.getBannerByName = catchAsync(async (req, res, next) => {
    const { name } = req.params;

    const banner = await Banner.findOne({
        name: name.toLowerCase(),
        isActive: true,
        startDate: { $lte: new Date() },
        $or: [
            { endDate: { $gte: new Date() } },
            { endDate: null }
        ]
    }).select('-createdBy -__v');

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

// @desc    Get all active banners
// @route   GET /api/v1/banners/active
// @access  Public
exports.getActiveBanners = catchAsync(async (req, res, next) => {
    const { page, position, bannerType, limit = 50 } = req.query;

    const query = {
        isActive: true,
        startDate: { $lte: new Date() },
        $or: [
            { endDate: { $gte: new Date() } },
            { endDate: null }
        ]
    };

    if (page) {
        query.page = { $in: [page, 'all'] };
    }

    if (position) {
        query.position = position;
    }

    if (bannerType) {
        query.bannerType = bannerType;
    }

    const banners = await Banner.find(query)
        .sort('displayOrder')
        .limit(parseInt(limit))
        .select('-createdBy -__v');

    res.status(200).json({
        status: 'success',
        results: banners.length,
        data: {
            banners
        }
    });
});
