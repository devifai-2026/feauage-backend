const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

// @desc    Get all users (admin only)
// @route   GET /api/v1/users
// @access  Private/Admin
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(User.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const users = await features.query.select('-__v');
  const total = await User.countDocuments(features.filterQuery);

  res.status(200).json({
    status: 'success',
    results: users.length,
    total,
    data: {
      users
    }
  });
});

// @desc    Get single user
// @route   GET /api/v1/users/:id
// @access  Private/Admin
exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .populate('cart')
    .populate('wishlist')
    .populate('addresses');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// @desc    Create user (admin only)
// @route   POST /api/v1/users
// @access  Private/Admin
exports.createUser = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      user: newUser
    }
  });
});

// @desc    Update user (admin only)
// @route   PATCH /api/v1/users/:id
// @access  Private/Admin
exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// @desc    Delete user (admin only)
// @route   DELETE /api/v1/users/:id
// @access  Private/Admin
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Soft delete - set isActive to false
  user.isActive = false;
  await user.save();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Get user addresses
// @route   GET /api/v1/users/addresses
// @access  Private
exports.getUserAddresses = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    status: 'success',
    data: {
      addresses: user.addresses
    }
  });
});

// @desc    Add user address
// @route   POST /api/v1/users/addresses
// @access  Private
exports.addUserAddress = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  // If this is the first address or user wants to set as default, set isDefault to true
  if (user.addresses.length === 0 || req.body.isDefault) {
    // Reset all other addresses to non-default
    user.addresses.forEach(address => {
      address.isDefault = false;
    });
    req.body.isDefault = true;
  }

  user.addresses.push(req.body);
  await user.save();

  res.status(201).json({
    status: 'success',
    data: {
      addresses: user.addresses
    }
  });
});

// @desc    Update user address
// @route   PATCH /api/v1/users/addresses/:addressId
// @access  Private
exports.updateUserAddress = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  const address = user.addresses.id(req.params.addressId);

  if (!address) {
    return next(new AppError('Address not found', 404));
  }

  // If setting as default, reset all other addresses
  if (req.body.isDefault) {
    user.addresses.forEach(addr => {
      addr.isDefault = false;
    });
  }

  // Update address fields
  address.set(req.body);

  await user.save();

  res.status(200).json({
    status: 'success',
    data: {
      address
    }
  });
});

// @desc    Delete user address
// @route   DELETE /api/v1/users/addresses/:addressId
// @access  Private
exports.deleteUserAddress = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  const address = user.addresses.id(req.params.addressId);

  if (!address) {
    return next(new AppError('Address not found', 404));
  }

  const wasDefault = address.isDefault;

  // Remove address
  address.remove();

  // If default address was deleted and there are other addresses, set first as default
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Set default address
// @route   PATCH /api/v1/users/addresses/:addressId/set-default
// @access  Private
exports.setDefaultAddress = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  const address = user.addresses.id(req.params.addressId);

  if (!address) {
    return next(new AppError('Address not found', 404));
  }

  // Reset all addresses to non-default
  user.addresses.forEach(addr => {
    addr.isDefault = false;
  });

  // Set selected as default
  address.isDefault = true;

  await user.save();

  res.status(200).json({
    status: 'success',
    data: {
      address
    }
  });
});

// @desc    Get user orders
// @route   GET /api/v1/users/orders
// @access  Private
exports.getUserOrders = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    Order.find({ user: req.user.id }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const orders = await features.query
    .populate('items.product', 'name images')
    .sort('-createdAt');

  const total = await Order.countDocuments({
    user: req.user.id,
    ...features.filterQuery
  });

  res.status(200).json({
    status: 'success',
    results: orders.length,
    total,
    data: {
      orders
    }
  });
});

// @desc    Get user reviews
// @route   GET /api/v1/users/reviews
// @access  Private
exports.getUserReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find({ user: req.user.id })
    .populate('product', 'name images')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      reviews
    }
  });
});

// @desc    Update user profile image
// @route   PATCH /api/v1/users/profile-image
// @access  Private
exports.updateProfileImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload an image', 400));
  }

  const user = await User.findById(req.user.id);
  user.profileImage = req.file.location; // S3 URL
  await user.save();

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// @desc    Get user dashboard stats
// @route   GET /api/v1/users/dashboard/stats
// @access  Private
exports.getUserDashboardStats = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  // Get order stats
  const orderStats = await Order.aggregate([
    {
      $match: { user: userId }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$grandTotal' },
        pendingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        }
      }
    }
  ]);

  // Get wishlist count
  const user = await User.findById(userId).populate('wishlist');
  const wishlistCount = user.wishlist.items.length;

  // Get cart count
  const cart = await Cart.findById(user.cart).populate('items');
  const cartCount = cart ? cart.items.length : 0;

  // Get recent orders
  const recentOrders = await Order.find({ user: userId })
    .sort('-createdAt')
    .limit(5)
    .select('orderId status grandTotal createdAt');

  res.status(200).json({
    status: 'success',
    data: {
      stats: orderStats[0] || {
        totalOrders: 0,
        totalSpent: 0,
        pendingOrders: 0,
        deliveredOrders: 0
      },
      wishlistCount,
      cartCount,
      recentOrders
    }
  });
});