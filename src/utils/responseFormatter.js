const { HTTP_STATUS } = require('../constants');

/**
 * Response Formatter Utility
 * Standardizes all API responses across the application
 */
class ResponseFormatter {
    /**
     * Send success response
     * @param {Object} res - Express response object
     * @param {Object} data - Response data
     * @param {Number} statusCode - HTTP status code (default: 200)
     * @param {String} message - Optional success message
     */
    static success(res, data = {}, statusCode = HTTP_STATUS.OK, message = null) {
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
     * @param {Number} statusCode - HTTP status code (default: 500)
     * @param {Object} errors - Validation errors (optional)
     * @param {String} errorCode - Application error code (optional)
     */
    static error(res, message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, errors = null, errorCode = null) {
        const response = {
            status: 'error',
            message,
            ...(errorCode && { errorCode }),
            ...(errors && { errors }),
        };

        return res.status(statusCode).json(response);
    }

    /**
     * Send validation error response
     * @param {Object} res - Express response object
     * @param {Object} errors - Validation errors
     * @param {String} message - Error message (default: 'Validation failed')
     */
    static validationError(res, errors, message = 'Validation failed') {
        return this.error(res, message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errors, 'VALIDATION_ERROR');
    }

    /**
     * Send not found response
     * @param {Object} res - Express response object
     * @param {String} resource - Resource name (e.g., 'User', 'Product')
     */
    static notFound(res, resource = 'Resource') {
        return this.error(res, `${resource} not found`, HTTP_STATUS.NOT_FOUND, null, 'NOT_FOUND');
    }

    /**
     * Send unauthorized response
     * @param {Object} res - Express response object
     * @param {String} message - Error message
     */
    static unauthorized(res, message = 'Unauthorized access') {
        return this.error(res, message, HTTP_STATUS.UNAUTHORIZED, null, 'AUTHENTICATION_ERROR');
    }

    /**
     * Send forbidden response
     * @param {Object} res - Express response object
     * @param {String} message - Error message
     */
    static forbidden(res, message = 'Access forbidden') {
        return this.error(res, message, HTTP_STATUS.FORBIDDEN, null, 'AUTHORIZATION_ERROR');
    }

    /**
     * Send paginated response
     * @param {Object} res - Express response object
     * @param {Array} data - Array of items
     * @param {Number} page - Current page
     * @param {Number} limit - Items per page
     * @param {Number} total - Total count
     * @param {Object} meta - Additional metadata
     */
    static paginated(res, data, page, limit, total, meta = {}) {
        const totalPages = Math.ceil(total / limit);

        const response = {
            status: 'success',
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
            ...meta,
        };

        return res.status(HTTP_STATUS.OK).json(response);
    }

    /**
     * Send created response
     * @param {Object} res - Express response object
     * @param {Object} data - Created resource data
     * @param {String} message - Success message
     */
    static created(res, data, message = 'Resource created successfully') {
        return this.success(res, data, HTTP_STATUS.CREATED, message);
    }

    /**
     * Send no content response
     * @param {Object} res - Express response object
     */
    static noContent(res) {
        return res.status(HTTP_STATUS.NO_CONTENT).send();
    }
}

module.exports = ResponseFormatter;
