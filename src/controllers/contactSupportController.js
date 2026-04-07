const ContactSupport = require('../models/ContactSupport');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const brevoService = require('../services/brevoService');

// @desc    Create a new contact support submission
// @route   POST /api/v1/contact/create
// @access  Public
exports.createContactSupport = catchAsync(async (req, res, next) => {
  const { name, email, message } = req.body;
  console.log('Received contact support request:', { name, email, message });
  // Validation
  if (!name || !email || !message) {
    return next(new AppError('Please provide name, email, and message', 400));
  }

  try {
    // Step 1: Send email first
    await brevoService.sendContactFormEmail(
      { name, email, message },
      process.env.BREVO_SENDER_EMAIL
    );

    // Step 2: If email is successful, save to database
    const contactSupport = await ContactSupport.create({
      fullName : name,
      email,
      message,
      isEmailSend: true
    });

    res.status(201).json({
      status: 'success',
      message: 'Thank you for contacting us! Your message has been received and an email confirmation has been sent.',
      data: {
        contactSupport
      }
    });
  } catch (error) {
    // If email sending fails, don't save to database
    console.error('Contact form error:', error);
    return next(new AppError('Failed to process your request. Please try again later.', 500));
  }
});

// @desc    Get all contact support submissions
// @route   GET /api/v1/contact/getAllContactSupport
// @access  Private/Admin
exports.getAllContactSupport = catchAsync(async (req, res, next) => {
  const contactSupports = await ContactSupport.find().sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: contactSupports.length,
    data: {
      contactSupports
    }
  });
});