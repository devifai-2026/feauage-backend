const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

// @desc    Create review
// @route   POST /api/v1/reviews
// @access  Private
exports.createReview = catchAsync(async (req, res, next) => {
  const { productId, rating, title, comment, images } = req.body;

  // Validate product
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(new AppError('Product not found', 404));
  }

  // Check if user has already reviewed this product
  const existingReview = await Review.findOne({
    product: productId,
    user: req.user.id
  });

  if (existingReview) {
    return next(new AppError('You have already reviewed this product', 400));
  }

  // Check if user has purchased the product (for verified purchase)
  let isVerifiedPurchase = false;

  const userOrders = await Order.find({
    user: req.user.id,
    status: 'delivered'
  });

  for (const order of userOrders) {
    const orderItem = await OrderItem.findOne({
      order: order._id,
      product: productId
    });

    if (orderItem) {
      isVerifiedPurchase = true;
      break;
    }
  }

  // Create review
  const review = await Review.create({
    product: productId,
    user: req.user.id,
    rating,
    title,
    comment,
    images: images || [],
    isVerifiedPurchase,
    isApproved: true // Auto-approved for development
  });

  res.status(201).json({
    status: 'success',
    data: {
      review
    }
  });
});

// @desc    Get product reviews
// @route   GET /api/v1/reviews/product/:productId
// @access  Public
exports.getProductReviews = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, rating, sort = 'newest' } = req.query;

  const query = {
    product: req.params.productId
  };

  // Filter by rating if provided
  if (rating) {
    query.rating = Number(rating);
  }

  // Sort options
  let sortOption = '-createdAt';
  switch (sort) {
    case 'oldest':
      sortOption = 'createdAt';
      break;
    case 'highest_rating':
      sortOption = '-rating';
      break;
    case 'lowest_rating':
      sortOption = 'rating';
      break;
    case 'most_helpful':
      sortOption = '-helpfulCount';
      break;
  }

  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName profileImage'),
    Review.countDocuments(query)
  ]);

  // Get rating distribution
  const ratingDistribution = await Review.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(req.params.productId)
      }
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } }
  ]);

  // Calculate average rating
  const avgRating = await Review.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(req.params.productId)
      }
    },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
    data: {
      reviews,
      stats: {
        averageRating: avgRating[0]?.averageRating || 0,
        totalReviews: avgRating[0]?.totalReviews || 0,
        ratingDistribution
      }
    }
  });
});

// @desc    Update review
// @route   PATCH /api/v1/reviews/:id
// @access  Private
exports.updateReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  // Check if review belongs to user
  if (review.user.toString() !== req.user.id) {
    return next(new AppError('Not authorized to update this review', 403));
  }

  // Only allow updating certain fields
  const allowedUpdates = ['rating', 'title', 'comment', 'images'];
  const updates = {};

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  // Update review
  const updatedReview = await Review.findByIdAndUpdate(
    req.params.id,
    updates,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      review: updatedReview
    }
  });
});

// @desc    Delete review
// @route   DELETE /api/v1/reviews/:id
// @access  Private
exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  // Check if review belongs to user or user is admin
  if (review.user.toString() !== req.user.id && req.user.role === 'customer') {
    return next(new AppError('Not authorized to delete this review', 403));
  }

  await review.remove();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Mark review as helpful
// @route   POST /api/v1/reviews/:id/helpful
// @access  Private
exports.markHelpful = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  // Check if user has already marked this review
  // In a real app, you'd track which users marked which reviews
  // For simplicity, we'll just increment

  review.helpfulCount += 1;
  await review.save();

  res.status(200).json({
    status: 'success',
    data: {
      review
    }
  });
});

// @desc    Report review
// @route   POST /api/v1/reviews/:id/report
// @access  Private
exports.reportReview = catchAsync(async (req, res, next) => {
  const { reason } = req.body;

  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  // Check if user has already reported this review
  // In a real app, you'd track which users reported which reviews
  // For simplicity, we'll just increment

  review.reportedCount += 1;
  await review.save();

  // Notify admin about reported review
  // You can add notification logic here

  res.status(200).json({
    status: 'success',
    message: 'Review reported successfully',
    data: {
      review
    }
  });
});

// @desc    Get user reviews
// @route   GET /api/v1/reviews/user/:userId
// @access  Public
exports.getUserReviews = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    Review.find({
      user: req.params.userId,
      isApproved: true
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const reviews = await features.query
    .populate('product', 'name slug images')
    .sort('-createdAt');

  const total = await Review.countDocuments({
    user: req.params.userId,
    isApproved: true,
    ...features.filterQuery
  });

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    total,
    data: {
      reviews
    }
  });
});