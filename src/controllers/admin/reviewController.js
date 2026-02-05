const Review = require('../../models/Review');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

// @desc    Get all reviews
// @route   GET /api/v1/admin/reviews
// @access  Private/Admin
exports.getAllReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find()
    .populate('user', 'firstName lastName email')
    .populate('product', 'name sku')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      reviews
    }
  });
});

// @desc    Approve/Reject review
// @route   PATCH /api/v1/admin/reviews/:id/approve
// @access  Private/Admin
exports.updateReviewStatus = catchAsync(async (req, res, next) => {
  const { isApproved } = req.body;

  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { isApproved },
    { new: true, runValidators: true }
  );

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      review
    }
  });
});

// @desc    Delete review
// @route   DELETE /api/v1/admin/reviews/:id
// @access  Private/Admin
exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  await review.deleteOne();

  res.status(204).json({
    status: 'success',
    data: null
  });
});
