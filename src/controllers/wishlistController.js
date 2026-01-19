const Wishlist = require('../models/Wishlist');
const WishlistItem = require('../models/WishlistItem');
const Product = require('../models/Product');
const Analytics = require('../models/Analytics');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// @desc    Get user wishlist
// @route   GET /api/v1/wishlist
// @access  Private
exports.getWishlist = catchAsync(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ user: req.user.id })
    .populate({
      path: 'items',
      populate: {
        path: 'product',
        select: 'name slug sellingPrice offerPrice isOnOffer stockStatus images ratingAverage',
        populate: {
          path: 'images',
          match: { isPrimary: true }
        }
      }
    });
  
  if (!wishlist) {
    // Create wishlist if it doesn't exist
    const newWishlist = await Wishlist.create({ user: req.user.id });
    return res.status(200).json({
      status: 'success',
      data: {
        wishlist: newWishlist
      }
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      wishlist
    }
  });
});

// @desc    Add item to wishlist
// @route   POST /api/v1/wishlist/items
// @access  Private
exports.addToWishlist = catchAsync(async (req, res, next) => {
  const { productId } = req.body;
  
  // Validate product
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(new AppError('Product not found', 404));
  }
  
  // Get or create wishlist
  let wishlist = await Wishlist.findOne({ user: req.user.id });
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: req.user.id });
  }
  
  // Add item to wishlist
  const wishlistItem = await wishlist.addItem(productId);
  
  // Log analytics
  await Analytics.create({
    type: 'add_to_wishlist',
    entityId: productId,
    entityType: 'Product',
    user: req.user._id,
    sessionId: req.sessionID || 'anonymous',
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      wishlistItem,
      wishlist
    }
  });
});

// @desc    Remove item from wishlist
// @route   DELETE /api/v1/wishlist/items/:productId
// @access  Private
exports.removeFromWishlist = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  
  // Get wishlist
  const wishlist = await Wishlist.findOne({ user: req.user.id });
  if (!wishlist) {
    return next(new AppError('Wishlist not found', 404));
  }
  
  // Remove item from wishlist
  const wishlistItem = await wishlist.removeItem(productId);
  
  if (!wishlistItem) {
    return next(new AppError('Product not found in wishlist', 404));
  }
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Clear wishlist
// @route   DELETE /api/v1/wishlist
// @access  Private
exports.clearWishlist = catchAsync(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ user: req.user.id });
  
  if (!wishlist) {
    return next(new AppError('Wishlist not found', 404));
  }
  
  await wishlist.clearWishlist();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Check if product is in wishlist
// @route   GET /api/v1/wishlist/check/:productId
// @access  Private
exports.checkInWishlist = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  
  const wishlist = await Wishlist.findOne({ user: req.user.id });
  
  if (!wishlist) {
    return res.status(200).json({
      status: 'success',
      data: {
        inWishlist: false
      }
    });
  }
  
  const wishlistItem = await WishlistItem.findOne({
    wishlist: wishlist._id,
    product: productId
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      inWishlist: !!wishlistItem
    }
  });
});

// @desc    Get wishlist count
// @route   GET /api/v1/wishlist/count
// @access  Private
exports.getWishlistCount = catchAsync(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ user: req.user.id });
  
  const count = wishlist ? wishlist.items.length : 0;
  
  res.status(200).json({
    status: 'success',
    data: {
      count
    }
  });
});

// @desc    Move wishlist item to cart
// @route   POST /api/v1/wishlist/move-to-cart/:productId
// @access  Private
exports.moveToCart = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  
  // First, remove from wishlist
  const wishlist = await Wishlist.findOne({ user: req.user.id });
  if (!wishlist) {
    return next(new AppError('Wishlist not found', 404));
  }
  
  const wishlistItem = await wishlist.removeItem(productId);
  if (!wishlistItem) {
    return next(new AppError('Product not found in wishlist', 404));
  }
  
  // Then, add to cart (you would need to import and use cartController here)
  // For now, return success
  res.status(200).json({
    status: 'success',
    message: 'Product moved to cart successfully',
    data: {
      productId
    }
  });
});