const mongoose = require('mongoose');
const Review = require('../../models/Review');
const Product = require('../../models/Product');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

// @desc    Get all reviews (filterable by moderation status)
// @route   GET /api/v1/admin/reviews
// @access  Private/Admin
exports.getAllReviews = catchAsync(async (req, res, next) => {
  const { status, product, rating, source, page = 1, limit = 50 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (product) query.product = product;
  if (rating) query.rating = Number(rating);
  if (source) query.source = source;

  const skip = (Number(page) - 1) * Number(limit);

  const [reviews, total, pendingCount] = await Promise.all([
    Review.find(query)
      .populate('user', 'firstName lastName email')
      .populate('product', 'name sku')
      .populate('moderatedBy', 'firstName lastName')
      .populate('createdByAdmin', 'firstName lastName')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit)),
    Review.countDocuments(query),
    Review.countDocuments({ status: 'pending' })
  ]);

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    total,
    pendingCount,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    data: { reviews }
  });
});

// @desc    Approve / reject / re-queue a review
// @route   PATCH /api/v1/admin/reviews/:id/status
// @access  Private/Admin
exports.updateReviewStatus = catchAsync(async (req, res, next) => {
  const { status, isApproved, rejectionReason } = req.body;

  // Accept the legacy boolean as well as the newer tri-state.
  let nextStatus = status;
  if (!nextStatus && isApproved !== undefined) {
    nextStatus = isApproved ? 'approved' : 'rejected';
  }

  if (!['pending', 'approved', 'rejected'].includes(nextStatus)) {
    return next(new AppError("status must be one of: pending, approved, rejected", 400));
  }

  const review = await Review.findById(req.params.id);
  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  review.status = nextStatus;
  review.moderatedBy = req.user.id;
  review.moderatedAt = new Date();
  if (nextStatus === 'rejected' && rejectionReason) {
    review.rejectionReason = rejectionReason;
  }
  await review.save();

  // Approving or rejecting changes which reviews count toward the public score.
  await Review.updateProductRatings(review.product);

  res.status(200).json({
    status: 'success',
    data: { review }
  });
});

// @desc    Edit a review's content, then (optionally) publish it
// @route   PATCH /api/v1/admin/reviews/:id
// @access  Private/Admin
exports.editReview = catchAsync(async (req, res, next) => {
  const { rating, title, comment, authorName, status } = req.body;

  const review = await Review.findById(req.params.id);
  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  const editsShopperText =
    review.source === 'customer' &&
    ((comment !== undefined && comment !== review.comment) ||
      (title !== undefined && title !== review.title));

  // Preserve what the shopper actually wrote the first time an admin edits it.
  // Their words are evidence; an edit must not erase them silently.
  if (editsShopperText && !review.editedByAdmin) {
    review.originalComment = review.comment;
    review.originalTitle = review.title;
    review.editedByAdmin = true;
  }

  if (rating !== undefined) review.rating = rating;
  if (title !== undefined) review.title = title;
  if (comment !== undefined) review.comment = comment;

  // authorName only applies to admin-authored rows; a customer review's
  // attribution comes from their user account and must not be rewritten.
  if (authorName !== undefined) {
    if (review.source !== 'admin') {
      return next(
        new AppError('authorName can only be set on admin-authored reviews', 400)
      );
    }
    review.authorName = authorName;
  }

  if (status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return next(new AppError("status must be one of: pending, approved, rejected", 400));
    }
    review.status = status;
    review.moderatedBy = req.user.id;
    review.moderatedAt = new Date();
  }

  await review.save();
  await Review.updateProductRatings(review.product);

  res.status(200).json({
    status: 'success',
    data: { review }
  });
});

// @desc    Add an admin-authored review (a real testimonial collected offline)
// @route   POST /api/v1/admin/reviews
// @access  Private/Admin
//
// These are stored with source: 'admin' and surfaced to shoppers with that
// label. They are NOT a way to manufacture customer feedback: the storefront
// shows them as store-published testimonials, never as verified purchases.
exports.createAdminReview = catchAsync(async (req, res, next) => {
  const { productId, rating, title, comment, authorName, images, status } = req.body;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return next(new AppError('A valid productId is required', 400));
  }
  if (!rating || rating < 1 || rating > 5) {
    return next(new AppError('rating must be between 1 and 5', 400));
  }
  if (!comment || !comment.trim()) {
    return next(new AppError('comment is required', 400));
  }
  if (!authorName || !authorName.trim()) {
    return next(
      new AppError('authorName is required so the testimonial is attributable', 400)
    );
  }

  const product = await Product.findById(productId);
  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  const review = await Review.create({
    product: productId,
    user: null,
    source: 'admin',
    authorName: authorName.trim(),
    createdByAdmin: req.user.id,
    rating,
    title,
    comment,
    images: images || [],
    // Admin-authored entries are never "verified purchase" — there is no order
    // behind them, and claiming otherwise would misrepresent them to shoppers.
    isVerifiedPurchase: false,
    status: status === 'approved' ? 'approved' : 'pending',
    moderatedBy: req.user.id,
    moderatedAt: new Date()
  });

  await Review.updateProductRatings(productId);

  res.status(201).json({
    status: 'success',
    data: { review }
  });
});

// @desc    Delete review
// @route   DELETE /api/v1/admin/reviews/:id
// @access  Private/Admin
exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findByIdAndDelete(req.params.id);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  await Review.updateProductRatings(review.product);

  res.status(204).json({
    status: 'success',
    data: null
  });
});
