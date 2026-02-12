/**
 * Response Helper Functions
 * Standardized response utilities to reduce duplication
 */

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Optional message
 */
function sendSuccess(res, data, statusCode = 200, message = null) {
    const response = {
        status: 'success',
        ...(message && { message }),
        data,
    };
    return res.status(statusCode).json(response);
}

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code
 */
function sendError(res, message, statusCode = 500) {
    return res.status(statusCode).json({
        status: 'error',
        message,
    });
}

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Data array
 * @param {Number} total - Total count
 * @param {Number} page - Current page
 * @param {Number} limit - Items per page
 */
function sendPaginated(res, data, total, page, limit) {
    return res.status(200).json({
        status: 'success',
        results: data.length,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
        data,
    });
}

module.exports = {
    sendSuccess,
    sendError,
    sendPaginated,
};
