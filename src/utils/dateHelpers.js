const { TIMEZONE } = require('../constants');

/**
 * Date and Time Helper Functions
 * Centralized utilities for date/time operations
 */

/**
 * Convert UTC date to IST (Indian Standard Time)
 * @param {Date} date - UTC date (optional, defaults to now)
 * @returns {Date} IST date
 */
function toIST(date = new Date()) {
    return new Date(date.getTime() + TIMEZONE.IST_OFFSET);
}

/**
 * Get start of day in IST
 * @param {Date} date - Date (optional, defaults to today)
 * @returns {Date} Start of day in IST
 */
function getISTStartOfDay(date = new Date()) {
    const istDate = toIST(date);
    istDate.setHours(0, 0, 0, 0);
    return istDate;
}

/**
 * Get end of day in IST
 * @param {Date} date - Date (optional, defaults to today)
 * @returns {Date} End of day in IST
 */
function getISTEndOfDay(date = new Date()) {
    const istDate = toIST(date);
    istDate.setHours(23, 59, 59, 999);
    return istDate;
}

/**
 * Get date range for last N days in IST
 * @param {Number} days - Number of days
 * @returns {Object} { startDate, endDate }
 */
function getLastNDaysRange(days) {
    const endDate = toIST();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
    return { startDate, endDate };
}

/**
 * Get current month range in IST
 * @returns {Object} { startDate, endDate }
 */
function getCurrentMonthRange() {
    const now = toIST();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startDate, endDate };
}

/**
 * Get previous month range in IST
 * @returns {Object} { startDate, endDate }
 */
function getPreviousMonthRange() {
    const now = toIST();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { startDate, endDate };
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 * @param {Date} date - Date to format
 * @returns {String} Formatted date string
 */
function formatDateISO(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Check if date is today
 * @param {Date} date - Date to check
 * @returns {Boolean}
 */
function isToday(date) {
    const today = getISTStartOfDay();
    const checkDate = getISTStartOfDay(date);
    return today.getTime() === checkDate.getTime();
}

/**
 * Get week start and end dates
 * @param {Date} date - Date within the week
 * @returns {Object} { startDate, endDate }
 */
function getWeekRange(date = new Date()) {
    const d = toIST(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday

    const startDate = new Date(d.setDate(diff));
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
}

module.exports = {
    toIST,
    getISTStartOfDay,
    getISTEndOfDay,
    getLastNDaysRange,
    getCurrentMonthRange,
    getPreviousMonthRange,
    formatDateISO,
    isToday,
    getWeekRange,
};
