const Notification = require('../../models/Notification');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

// @desc    Get all notifications for admin
// @route   GET /api/v1/admin/notifications
// @access  Private/Admin
exports.getNotifications = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20, type, priority, unreadOnly } = req.query;

  const result = await Notification.getAdminNotifications({
    page: parseInt(page),
    limit: parseInt(limit),
    type,
    priority,
    unreadOnly: unreadOnly === 'true',
    adminId: req.user.id
  });

  // Add isRead field to each notification
  const notificationsWithReadStatus = result.notifications.map(notification => ({
    ...notification,
    isRead: notification.readBy?.some(read => read.user?.toString() === req.user.id)
  }));

  res.status(200).json({
    status: 'success',
    data: {
      notifications: notificationsWithReadStatus,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    }
  });
});

// @desc    Get unread notifications count
// @route   GET /api/v1/admin/notifications/unread-count
// @access  Private/Admin
exports.getUnreadCount = catchAsync(async (req, res, next) => {
  const count = await Notification.getUnreadCount(req.user.id);

  res.status(200).json({
    status: 'success',
    data: {
      unreadCount: count
    }
  });
});

// @desc    Get recent unread notifications
// @route   GET /api/v1/admin/notifications/recent
// @access  Private/Admin
exports.getRecentNotifications = catchAsync(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const notifications = await Notification.getUnreadForAdmin(req.user.id, parseInt(limit));

  res.status(200).json({
    status: 'success',
    data: {
      notifications
    }
  });
});

// @desc    Mark notification as read
// @route   PATCH /api/v1/admin/notifications/:id/read
// @access  Private/Admin
exports.markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.markAsRead(req.params.id, req.user.id);

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      notification
    }
  });
});

// @desc    Mark all notifications as read
// @route   PATCH /api/v1/admin/notifications/mark-all-read
// @access  Private/Admin
exports.markAllAsRead = catchAsync(async (req, res, next) => {
  await Notification.markAllAsRead(req.user.id);

  res.status(200).json({
    status: 'success',
    message: 'All notifications marked as read'
  });
});

// @desc    Delete notification
// @route   DELETE /api/v1/admin/notifications/:id
// @access  Private/Admin
exports.deleteNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Notification deleted'
  });
});

// @desc    Clear all notifications
// @route   DELETE /api/v1/admin/notifications/clear-all
// @access  Private/Admin
exports.clearAllNotifications = catchAsync(async (req, res, next) => {
  await Notification.updateMany(
    {
      recipients: { $in: ['admin', 'superadmin', 'all'] }
    },
    { isActive: false }
  );

  res.status(200).json({
    status: 'success',
    message: 'All notifications cleared'
  });
});

// @desc    Get notification by ID
// @route   GET /api/v1/admin/notifications/:id
// @access  Private/Admin
exports.getNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  // Mark as read automatically when viewing
  if (!notification.isReadByUser(req.user.id)) {
    await Notification.markAsRead(req.params.id, req.user.id);
  }

  res.status(200).json({
    status: 'success',
    data: {
      notification
    }
  });
});
