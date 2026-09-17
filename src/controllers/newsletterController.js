const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const brevoService = require('../services/brevoService');

// @desc    Subscribe an email to the newsletter
// @route   POST /api/v1/newsletter/subscribe
// @access  Public
exports.subscribe = catchAsync(async (req, res, next) => {
  const email = (req.body.email || '').trim().toLowerCase();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return next(new AppError('Please provide a valid email address', 400));
  }

  const existing = await NewsletterSubscriber.findOne({ email });
  if (existing && existing.isActive) {
    // Idempotent: re-subscribing is not an error for the visitor.
    return res.status(200).json({
      status: 'success',
      message: "You're already subscribed."
    });
  }

  const subscriber =
    existing || new NewsletterSubscriber({ email, source: req.body.source || 'footer' });
  subscriber.isActive = true;

  // Store first, sync second — a Brevo failure must not lose the signup.
  const result = await brevoService.addContact(email);
  subscriber.syncedToBrevo = result.ok;
  subscriber.brevoError = result.ok ? null : result.error;
  await subscriber.save();

  res.status(201).json({
    status: 'success',
    message: 'Thanks for subscribing!'
  });
});

// @desc    List subscribers (admin)
// @route   GET /api/v1/admin/newsletter
// @access  Private/Admin
exports.getSubscribers = catchAsync(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;

  const [subscribers, total] = await Promise.all([
    NewsletterSubscriber.find()
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    NewsletterSubscriber.countDocuments()
  ]);

  res.status(200).json({
    status: 'success',
    results: subscribers.length,
    total,
    data: { subscribers }
  });
});

// @desc    Remove a subscriber (admin)
// @route   DELETE /api/v1/admin/newsletter/:id
// @access  Private/Admin
exports.deleteSubscriber = catchAsync(async (req, res, next) => {
  const subscriber = await NewsletterSubscriber.findByIdAndDelete(req.params.id);
  if (!subscriber) return next(new AppError('Subscriber not found', 404));

  res.status(200).json({ status: 'success', data: null });
});
