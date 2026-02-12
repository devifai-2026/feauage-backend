const mongoose = require('mongoose');

const guestUserSchema = new mongoose.Schema({
    guestId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    sessionId: {
        type: String,
        required: true
    },
    ipAddress: String,
    userAgent: String,
    referrer: String,

    // Tracking data
    firstVisit: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastVisit: {
        type: Date,
        default: Date.now
    },
    visitCount: {
        type: Number,
        default: 1
    },

    // Conversion tracking
    convertedToUser: {
        type: Boolean,
        default: false,
        index: true
    },
    convertedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    convertedAt: {
        type: Date,
        index: true
    },

    // Activity tracking
    pagesViewed: [{
        url: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    productsViewed: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],

    // Location data (optional - can be populated via IP lookup)
    country: String,
    city: String,
    region: String,

    // Device info
    deviceType: {
        type: String,
        enum: ['mobile', 'tablet', 'desktop', 'unknown'],
        default: 'unknown'
    },
    browser: String,
    os: String,

    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
guestUserSchema.index({ guestId: 1 }, { unique: true });
guestUserSchema.index({ createdAt: -1 });
guestUserSchema.index({ convertedToUser: 1, createdAt: -1 });
guestUserSchema.index({ isActive: 1 });
guestUserSchema.index({ lastVisit: -1 });

// Virtual for total pages viewed
guestUserSchema.virtual('totalPagesViewed').get(function () {
    return this.pagesViewed?.length || 0;
});

// Virtual for total products viewed
guestUserSchema.virtual('totalProductsViewed').get(function () {
    return this.productsViewed?.length || 0;
});

// Static method to get guest statistics
guestUserSchema.statics.getGuestStats = async function (startDate, endDate) {
    const stats = await this.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: null,
                totalGuests: { $sum: 1 },
                convertedGuests: {
                    $sum: { $cond: ['$convertedToUser', 1, 0] }
                },
                activeGuests: {
                    $sum: { $cond: ['$isActive', 1, 0] }
                },
                totalVisits: { $sum: '$visitCount' },
                avgVisitsPerGuest: { $avg: '$visitCount' }
            }
        }
    ]);

    return stats[0] || {
        totalGuests: 0,
        convertedGuests: 0,
        activeGuests: 0,
        totalVisits: 0,
        avgVisitsPerGuest: 0
    };
};

// Static method to get conversion rate
guestUserSchema.statics.getConversionRate = async function (startDate, endDate) {
    const result = await this.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                converted: {
                    $sum: { $cond: ['$convertedToUser', 1, 0] }
                }
            }
        },
        {
            $project: {
                _id: 0,
                total: 1,
                converted: 1,
                conversionRate: {
                    $cond: [
                        { $eq: ['$total', 0] },
                        0,
                        { $multiply: [{ $divide: ['$converted', '$total'] }, 100] }
                    ]
                }
            }
        }
    ]);

    return result[0] || { total: 0, converted: 0, conversionRate: 0 };
};

// Instance method to track page view
guestUserSchema.methods.trackPageView = function (url) {
    this.pagesViewed.push({
        url,
        timestamp: new Date()
    });
    this.lastVisit = new Date();
    return this.save();
};

// Instance method to track product view
guestUserSchema.methods.trackProductView = function (productId) {
    this.productsViewed.push({
        productId,
        timestamp: new Date()
    });
    this.lastVisit = new Date();
    return this.save();
};

// Instance method to convert to user
guestUserSchema.methods.convertToUser = function (userId) {
    this.convertedToUser = true;
    this.convertedUserId = userId;
    this.convertedAt = new Date();
    return this.save();
};

const GuestUser = mongoose.model('GuestUser', guestUserSchema);

module.exports = GuestUser;
