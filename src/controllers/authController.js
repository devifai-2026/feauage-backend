const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const GuestUser = require('../models/GuestUser');
const Analytics = require('../models/Analytics');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../services/emailService');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = catchAsync(async (req, res, next) => {
  const { email, password, firstName, lastName, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('User with this email already exists', 400));
  }

  // Create user
  const newUser = await User.create({
    email,
    password,
    firstName,
    lastName,
    phone
  });

  // Create cart for user
  const cart = await Cart.create({ user: newUser._id });

  // Create wishlist for user
  const wishlist = await Wishlist.create({ user: newUser._id });

  // Update user with cart and wishlist references
  newUser.cart = cart._id;
  newUser.wishlist = wishlist._id;
  await newUser.save();

  // Convert guest user to registered user if guestId provided
  const guestId = req.headers['x-guest-id'] || req.cookies?.guestId || req.body.guestId;
  if (guestId) {
    try {
      const guestUser = await GuestUser.findOne({ guestId, isActive: true });
      if (guestUser) {
        await guestUser.convertToUser(newUser._id);
        await Analytics.updateMany({ guestId }, { $set: { user: newUser._id }, $unset: { guestUser: 1 } });
      }
    } catch (error) {
      // Silent fail - don't block registration if guest conversion fails
    }
  }

  // Generate verification token
  const verificationToken = newUser.createEmailVerificationToken();
  await newUser.save({ validateBeforeSave: false });

  // Send verification email
  try {
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email/${verificationToken}`;

    await new Email(newUser, verificationUrl).sendWelcome();

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: {
          _id: newUser._id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          isEmailVerified: newUser.isEmailVerified
        }
      }
    });
  } catch (error) {
    // If email fails, still send response but continue silently

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please verify your email later.',
      data: {
        user: {
          _id: newUser._id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          isEmailVerified: newUser.isEmailVerified
        }
      }
    });
  }
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) Check if user is active
  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 403));
  }
  // 4) Check if email is verified
  if (!user.isEmailVerified) {
    return next(new AppError('Please verify your email address before logging in', 401));
  }

  // 5) Check if account is locked
  if (user.isLocked()) {
    return next(new AppError('Account is temporarily locked. Please try again later.', 423));
  }

  // 6) Reset login attempts on successful login
  await user.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
    lastLogin: Date.now()
  });

  // 7) If everything ok, send token to client
  createSendToken(user, 200, res);
});

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
};

// @desc    Get current user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id)
    .populate('cart')
    .populate('wishlist')
    .populate('addresses');

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// @desc    Update user profile
// @route   PATCH /api/v1/auth/update-me
// @access  Private
exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError('This route is not for password updates. Please use /update-password.', 400));
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = {};
  const allowedFields = ['firstName', 'lastName', 'phone', 'gender', 'dateOfBirth', 'profileImage'];

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      filteredBody[field] = req.body[field];
    }
  });

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

// @desc    Update password
// @route   PATCH /api/v1/auth/update-password
// @access  Private
exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.newPassword;
  await user.save();

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgot-password
// @access  Public
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/auth/reset-password/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError('There was an error sending the email. Try again later!', 500));
  }
});

// @desc    Reset password
// @route   PATCH /api/v1/auth/reset-password/:token
// @access  Public
exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  // 3) Update changedPasswordAt property for the user
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

// @desc    Verify email
// @route   GET /api/v1/auth/verify-email/:token
// @access  Public
exports.verifyEmail = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }
  });

  // 2) If token has not expired, and there is user, verify email
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  // 3) Update email verification status
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  // 4) Send welcome email
  try {
    await new Email(user).sendWelcomeVerified();
  } catch (error) {
    logger.logError(error, { context: 'Welcome email sending failed', userId: user._id });
  }

  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully!'
  });
});

// @desc    Resend verification email
// @route   POST /api/v1/auth/resend-verification
// @access  Public
exports.resendVerification = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  // 1) Get user based on email
  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('There is no user with that email address.', 404));
  }

  // 2) Check if already verified
  if (user.isEmailVerified) {
    return next(new AppError('Email is already verified', 400));
  }

  // 3) Generate new verification token
  const verificationToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // 4) Send verification email
  try {
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email/${verificationToken}`;

    await new Email(user, verificationUrl).sendVerification();

    res.status(200).json({
      status: 'success',
      message: 'Verification email sent!'
    });
  } catch (err) {
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError('There was an error sending the email. Try again later!', 500));
  }
});

// @desc    Refresh token
// @route   POST /api/v1/auth/refresh-token
// @access  Private
exports.refreshToken = catchAsync(async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Please provide a token', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(new AppError('User recently changed password! Please log in again.', 401));
    }

    // Create new token
    const newToken = signToken(currentUser._id);

    res.status(200).json({
      status: 'success',
      token: newToken
    });
  } catch (error) {
    return next(new AppError('Invalid token', 401));
  }
});