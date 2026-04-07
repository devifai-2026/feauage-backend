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

// @desc    Get all contact support submissions with pagination & filters
// @route   GET /api/v1/contact/getAllContactSupport
// @access  Private/Admin
exports.getAllContactSupport = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Build filter
  const filter = {};
  
  // Status filter
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  // Search filter (search in name, email, subject)
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    filter.$or = [
      { fullName: searchRegex },
      { email: searchRegex },
      { subject: searchRegex }
    ];
  }

  // Execute query in parallel for efficiency
  const [contactSupports, total] = await Promise.all([
    ContactSupport.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    ContactSupport.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    status: 'success',
    total,
    totalPages,
    currentPage: page,
    results: contactSupports.length,
    data: {
      tickets: contactSupports
    }
  });
});