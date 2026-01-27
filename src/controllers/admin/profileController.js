const User = require('../../models/User');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const bcrypt = require('bcryptjs');

// @desc    Get current admin profile
// @route   GET /api/v1/admin/profile
// @access  Private/Admin
exports.getProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('-password -__v');

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

// @desc    Update admin profile
// @route   PATCH /api/v1/admin/profile
// @access  Private/Admin
exports.updateProfile = catchAsync(async (req, res, next) => {
  // Fields that are allowed to be updated
  const allowedFields = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'profileImage',
    'department',
    'location',
    'bio'
  ];

  // Filter out any fields that are not allowed
  const filteredBody = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredBody[key] = req.body[key];
    }
  });

  // Check if email is being changed and if it's already taken
  if (filteredBody.email && filteredBody.email !== req.user.email) {
    const existingUser = await User.findOne({ email: filteredBody.email });
    if (existingUser) {
      return next(new AppError('Email is already in use', 400));
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    filteredBody,
    {
      new: true,
      runValidators: true
    }
  ).select('-password -__v');

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

// @desc    Update admin password
// @route   PATCH /api/v1/admin/profile/password
// @access  Private/Admin
exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // Validate input
  if (!currentPassword || !newPassword || !confirmPassword) {
    return next(new AppError('Please provide current password, new password, and confirm password', 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new AppError('New password and confirm password do not match', 400));
  }

  if (newPassword.length < 8) {
    return next(new AppError('Password must be at least 8 characters long', 400));
  }

  // Get user with password
  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Check if current password is correct
  const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);

  if (!isPasswordCorrect) {
    return next(new AppError('Current password is incorrect', 401));
  }

  // Hash new password
  const salt = await bcrypt.genSalt(12);
  user.password = await bcrypt.hash(newPassword, salt);
  user.passwordChangedAt = Date.now();
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully'
  });
});

// @desc    Upload profile image
// @route   POST /api/v1/admin/profile/image
// @access  Private/Admin
exports.uploadProfileImage = catchAsync(async (req, res, next) => {
  if (!req.body.imageUrl) {
    return next(new AppError('Please provide an image URL', 400));
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { profileImage: req.body.imageUrl },
    { new: true, runValidators: true }
  ).select('-password -__v');

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

// @desc    Delete profile image
// @route   DELETE /api/v1/admin/profile/image
// @access  Private/Admin
exports.deleteProfileImage = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { profileImage: null },
    { new: true, runValidators: true }
  ).select('-password -__v');

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

// @desc    Get admin activity log
// @route   GET /api/v1/admin/profile/activity
// @access  Private/Admin
exports.getActivityLog = catchAsync(async (req, res, next) => {
  const AdminActivity = require('../../models/AdminActivity');
  const { page = 1, limit = 20 } = req.query;

  const activities = await AdminActivity.find({ admin: req.user.id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();

  const total = await AdminActivity.countDocuments({ admin: req.user.id });

  res.status(200).json({
    status: 'success',
    data: {
      activities,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    }
  });
});
