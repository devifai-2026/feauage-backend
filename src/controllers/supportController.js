const SupportTicket = require('../models/SupportTicket');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// @desc    Create a new support ticket (Public - Help Center form)
exports.createTicket = catchAsync(async (req, res, next) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return next(new AppError('Please provide name, email, subject, and message', 400));
  }

  const ticket = await SupportTicket.create({
    name,
    email,
    subject,
    message
  });

  res.status(201).json({
    status: 'success',
    message: 'Your support ticket has been submitted successfully. We will get back to you soon.',
    data: {
      ticket
    }
  });
});
