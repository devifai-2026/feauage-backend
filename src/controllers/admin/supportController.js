const SupportTicket = require('../../models/SupportTicket');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

// @desc    Get all support tickets (Admin)
exports.getAllTickets = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Build filter
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    filter.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { subject: searchRegex }
    ];
  }

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    SupportTicket.countDocuments(filter)
  ]);

  res.status(200).json({
    status: 'success',
    results: tickets.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: {
      tickets
    }
  });
});

// @desc    Get single support ticket (Admin)
exports.getTicket = catchAsync(async (req, res, next) => {
  const ticket = await SupportTicket.findById(req.params.id);

  if (!ticket) {
    return next(new AppError('Support ticket not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      ticket
    }
  });
});

// @desc    Update support ticket status and admin notes (Admin)
exports.updateTicket = catchAsync(async (req, res, next) => {
  const { status, adminNotes } = req.body;

  const updateData = {};
  if (status) updateData.status = status;
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

  const ticket = await SupportTicket.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!ticket) {
    return next(new AppError('Support ticket not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      ticket
    }
  });
});
