const GuestUser = require('../models/GuestUser');
const { v4: uuidv4 } = require('uuid');

/**
 * Middleware to track guest users
 * Checks for existing guestId in headers/cookies, creates new guest if not found
 */
exports.trackGuest = async (req, res, next) => {
    try {
        // Check for guestId in headers or cookies
        const guestId = req.headers['x-guest-id'] || req.cookies?.guestId;

        if (guestId) {
            // Existing guest - update last visit and increment visit count
            const guestUser = await GuestUser.findOneAndUpdate(
                { guestId, isActive: true },
                {
                    $set: { lastVisit: new Date() },
                    $inc: { visitCount: 1 }
                },
                { new: true }
            );

            if (guestUser) {
                req.guestId = guestId;
                req.guestUser = guestUser;
            } else {
                // GuestId exists but not found in DB - create new
                await createNewGuest(req, res);
            }
        } else {
            // New guest - create record
            await createNewGuest(req, res);
        }

        next();
    } catch (error) {
        console.error('Guest tracking error:', error);
        // Don't block the request if tracking fails
        next();
    }
};

/**
 * Helper function to create a new guest user
 */
async function createNewGuest(req, res) {
    const newGuestId = uuidv4();

    // Parse user agent for device info
    const userAgent = req.headers['user-agent'] || '';
    const deviceType = getDeviceType(userAgent);
    const browser = getBrowser(userAgent);
    const os = getOS(userAgent);

    const guestUser = await GuestUser.create({
        guestId: newGuestId,
        sessionId: req.sessionID || uuidv4(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: userAgent,
        referrer: req.headers.referer || req.headers.referrer,
        deviceType,
        browser,
        os
    });

    req.guestId = newGuestId;
    req.guestUser = guestUser;

    // Send guestId in response header
    res.setHeader('X-Guest-Id', newGuestId);

    // Optionally set cookie (7 days expiry)
    res.cookie('guestId', newGuestId, {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
}

/**
 * Middleware to track page views
 */
exports.trackPageView = async (req, res, next) => {
    try {
        if (req.guestUser && req.path) {
            await req.guestUser.trackPageView(req.path);
        }
        next();
    } catch (error) {
        console.error('Page view tracking error:', error);
        next();
    }
};

/**
 * Helper functions to parse user agent
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

module.exports = exports;
