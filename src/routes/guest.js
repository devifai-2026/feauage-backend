const express = require('express');
const router = express.Router();
const GuestUser = require('../models/GuestUser');
const Analytics = require('../models/Analytics');
const { trackGuest } = require('../middleware/guestTracking');
const { v4: uuidv4 } = require('uuid');

/**
 * @route   POST /api/guest/init
 * @desc    Initialize a new guest user
 * @access  Public
 */
router.post('/init', async (req, res) => {
    try {
        const { sessionId, referrer } = req.body;

        // Generate unique guest ID
        const guestId = uuidv4();

        // Parse user agent
        const userAgent = req.headers['user-agent'] || '';
        const deviceType = getDeviceType(userAgent);
        const browser = getBrowser(userAgent);
        const os = getOS(userAgent);

        // Create guest user
        const guestUser = await GuestUser.create({
            guestId,
            sessionId: sessionId || uuidv4(),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent,
            referrer: referrer || req.headers.referer,
            deviceType,
            browser,
            os
        });

        // Set cookie
        res.cookie('guestId', guestId, {
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        res.status(201).json({
            status: 'success',
            data: {
                guestId,
                deviceType,
                browser,
                os
            }
        });
    } catch (error) {
        console.error('Guest init error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to initialize guest user'
        });
    }
});

/**
 * @route   POST /api/guest/track
 * @desc    Track guest user activity
 * @access  Public
 */
router.post('/track', trackGuest, async (req, res) => {
    try {
        const { type, data } = req.body;

        if (!req.guestUser) {
            return res.status(400).json({
                status: 'error',
                message: 'Guest user not found'
            });
        }

        // Track different types of activities
        switch (type) {
            case 'page_view':
                if (data?.url) {
                    await req.guestUser.trackPageView(data.url);

                    // Also create analytics record
                    await Analytics.create({
                        type: 'page_view',
                        guestUser: req.guestUser._id,
                        guestId: req.guestId,
                        sessionId: req.guestUser.sessionId,
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent'],
                        metadata: { url: data.url }
                    });
                }
                break;

            case 'product_view':
                if (data?.productId) {
                    await req.guestUser.trackProductView(data.productId);

                    // Create analytics record
                    await Analytics.create({
                        type: 'product_view',
                        entityId: data.productId,
                        entityType: 'Product',
                        guestUser: req.guestUser._id,
                        guestId: req.guestId,
                        sessionId: req.guestUser.sessionId,
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent']
                    });
                }
                break;

            case 'add_to_cart':
                if (data?.productId) {
                    await Analytics.create({
                        type: 'add_to_cart',
                        entityId: data.productId,
                        entityType: 'Product',
                        guestUser: req.guestUser._id,
                        guestId: req.guestId,
                        sessionId: req.guestUser.sessionId,
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent'],
                        metadata: data
                    });
                }
                break;

            default:
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid tracking type'
                });
        }

        res.json({
            status: 'success',
            message: 'Activity tracked successfully'
        });
    } catch (error) {
        console.error('Guest tracking error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to track activity'
        });
    }
});

/**
 * @route   GET /api/guest/:guestId
 * @desc    Get guest user details
 * @access  Public
 */
router.get('/:guestId', async (req, res) => {
    try {
        const guestUser = await GuestUser.findOne({
            guestId: req.params.guestId,
            isActive: true
        });

        if (!guestUser) {
            return res.status(404).json({
                status: 'error',
                message: 'Guest user not found'
            });
        }

        res.json({
            status: 'success',
            data: {
                guestUser: {
                    guestId: guestUser.guestId,
                    visitCount: guestUser.visitCount,
                    firstVisit: guestUser.firstVisit,
                    lastVisit: guestUser.lastVisit,
                    totalPagesViewed: guestUser.totalPagesViewed,
                    totalProductsViewed: guestUser.totalProductsViewed,
                    deviceType: guestUser.deviceType,
                    browser: guestUser.browser,
                    os: guestUser.os
                }
            }
        });
    } catch (error) {
        console.error('Get guest error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get guest user'
        });
    }
});

/**
 * Helper functions
 */
function getDeviceType(userAgent) {
    const ua = userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
        return 'mobile';
    }
    return 'desktop';
}

function getBrowser(userAgent) {
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    return 'Unknown';
}

function getOS(userAgent) {
    const ua = userAgent.toLowerCase();
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac')) return 'MacOS';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
    return 'Unknown';
}

module.exports = router;
