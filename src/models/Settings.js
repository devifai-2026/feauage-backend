const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  gstRate: {
    type: Number,
    default: 0.03,
    min: [0, 'GST rate cannot be negative'],
    max: [1, 'GST rate cannot exceed 1']
  },
  cgstRate: {
    type: Number,
    default: 0.015
  },
  sgstRate: {
    type: Number,
    default: 0.015
  },
  freeShippingThreshold: {
    type: Number,
    default: 5000
  },
  metroShippingCharge: {
    type: Number,
    default: 50
  },
  standardShippingCharge: {
    type: Number,
    default: 100
  },
  metroPincodes: {
    type: [String],
    default: ['400001', '110001', '600001', '700001', '500001', '560001']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

/**
 * Get the singleton settings document.
 * Creates one with defaults if none exists.
 */
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
