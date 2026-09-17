const mongoose = require('mongoose');

/**
 * Newsletter signups from the storefront footer.
 *
 * Subscribers are always persisted here. Pushing them into a Brevo contact
 * list is a best-effort extra — if BREVO_API_KEY is unset or the call fails,
 * the signup still succeeds and `syncedToBrevo` stays false so it can be
 * reconciled later.
 */
const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    source: {
      type: String,
      default: 'footer',
      trim: true
    },
    syncedToBrevo: {
      type: Boolean,
      default: false
    },
    brevoError: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
