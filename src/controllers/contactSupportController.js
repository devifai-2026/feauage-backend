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

// @desc    Update contact support ticket (mark as read, etc.)
// @route   PATCH /api/v1/contact/updateContactSupport/:id
// @access  Private/Admin
exports.updateContactSupport = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { isRead } = req.body;

  // Validate ID
  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new AppError('Invalid ticket ID', 400));
  }

  // Validate request body (only allow updating isRead field)
  const allowedUpdates = ['isRead'];
  const updateKeys = Object.keys(req.body);
  const isValidUpdate = updateKeys.every(key => allowedUpdates.includes(key));

  if (!isValidUpdate) {
    return next(new AppError('Invalid update fields. Only "isRead" can be updated.', 400));
  }

  // Build update object
  const updateData = {};
  if (isRead !== undefined) {
    updateData.isRead = Boolean(isRead);
  }

  // Find and update the ticket
  const updatedTicket = await ContactSupport.findByIdAndUpdate(
    id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  // Check if ticket exists
  if (!updatedTicket) {
    return next(new AppError('Support ticket not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Ticket updated successfully',
    data: {
      contactSupport: updatedTicket
    }
  });
});

// @desc    Mark all contact support tickets as read
// @route   PATCH /api/v1/contact/markAllAsRead
// @access  Private/Admin
exports.markAllAsRead = catchAsync(async (req, res, next) => {
  // Update all tickets where isRead is false to true
  const result = await ContactSupport.updateMany(
    { isRead: false },
    { isRead: true },
    { multi: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'All tickets marked as read successfully',
    data: {
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    }
  });
});