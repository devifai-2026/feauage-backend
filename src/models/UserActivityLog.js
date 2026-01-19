// models/UserActivityLog.js
const mongoose = require('mongoose');

const userActivityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'USER_CREATED',
      'USER_UPDATED',
      'USER_ACTIVATED',
      'USER_DEACTIVATED',
      'USER_DELETED',
      'PROFILE_UPDATED',
      'PASSWORD_CHANGED',
      'LOGIN',
      'LOGOUT',
      'BULK_USER_UPDATE'
    ]
  },
  performedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const UserActivityLog = mongoose.model('UserActivityLog', userActivityLogSchema);

module.exports = UserActivityLog;