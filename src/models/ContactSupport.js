const mongoose = require('mongoose');

const contactSupportSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address'
    ]
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [1, 'Message must be at least 10 characters'],
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  isEmailSend: {
    type: Boolean,
    default: false
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
contactSupportSchema.index({ email: 1 });
contactSupportSchema.index({ isRead: 1 });
contactSupportSchema.index({ isEmailSend: 1 });
contactSupportSchema.index({ createdAt: -1 });

const ContactSupport = mongoose.model('ContactSupport', contactSupportSchema);

module.exports = ContactSupport;
