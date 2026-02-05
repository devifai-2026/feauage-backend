/**
 * Application Constants
 * Central location for all magic numbers, configuration values, and enums
 */

// Tax Configuration
const TAX_RATES = {
    GST: 0.03, // 3% GST for Jewelry in India
    CGST: 0.015, // 1.5% CGST
    SGST: 0.015, // 1.5% SGST
};

// Shipping Configuration
const SHIPPING = {
    FREE_THRESHOLD: 5000, // Free shipping above ₹5000
    METRO_CHARGE: 50, // ₹50 for metro cities
    STANDARD_CHARGE: 100, // ₹100 for other cities
    METRO_PINCODES: ['400001', '110001', '600001', '700001', '500001', '560001'],
};

// Order Status
const ORDER_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    RETURNED: 'returned',
    REFUNDED: 'refunded',
};

// Payment Status
const PAYMENT_STATUS = {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    PARTIALLY_REFUNDED: 'partially_refunded',
};

// Payment Methods
const PAYMENT_METHODS = {
    COD: 'cod',
    ONLINE: 'online',
    UPI: 'upi',
    CARD: 'card',
    NET_BANKING: 'netbanking',
    WALLET: 'wallet',
};

// Shipping Status
const SHIPPING_STATUS = {
    NOT_SHIPPED: 'not_shipped',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    IN_TRANSIT: 'in_transit',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    FAILED: 'failed',
    RETURNED: 'returned',
};

// User Roles
const USER_ROLES = {
    CUSTOMER: 'customer',
    ADMIN: 'admin',
    SUPER_ADMIN: 'super_admin',
};

// Pagination
const PAGINATION = {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
    DEFAULT_PAGE: 1,
};

// Product Status
const PRODUCT_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    OUT_OF_STOCK: 'out_of_stock',
    DISCONTINUED: 'discontinued',
};

// Stock Status
const STOCK_STATUS = {
    IN_STOCK: 'In Stock',
    LOW_STOCK: 'Low Stock',
    OUT_OF_STOCK: 'Out of Stock',
};

// Stock Thresholds
const STOCK_THRESHOLDS = {
    LOW_STOCK: 20,
    OUT_OF_STOCK: 0,
};

// Analytics Event Types
const ANALYTICS_EVENTS = {
    PAGE_VIEW: 'page_view',
    PRODUCT_VIEW: 'product_view',
    CATEGORY_VIEW: 'category_view',
    SEARCH: 'search',
    ADD_TO_CART: 'add_to_cart',
    ADD_TO_WISHLIST: 'add_to_wishlist',
    PURCHASE: 'purchase',
    CHECKOUT_START: 'checkout_start',
    CHECKOUT_COMPLETE: 'checkout_complete',
};

// Device Types
const DEVICE_TYPES = {
    MOBILE: 'mobile',
    TABLET: 'tablet',
    DESKTOP: 'desktop',
    UNKNOWN: 'unknown',
};

// Cookie Configuration
const COOKIES = {
    GUEST_ID_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
};

// Time Periods
const TIME_PERIODS = {
    WEEK: 7,
    MONTH: 30,
    QUARTER: 90,
    YEAR: 365,
};

// Date Formats
const DATE_FORMATS = {
    ISO: 'YYYY-MM-DD',
    DISPLAY: 'DD MMM YYYY',
    DATETIME: 'YYYY-MM-DD HH:mm:ss',
    TIME: 'HH:mm:ss',
};

// Email Templates
const EMAIL_TYPES = {
    WELCOME: 'welcome',
    VERIFICATION: 'verification',
    PASSWORD_RESET: 'password_reset',
    ORDER_CONFIRMATION: 'order_confirmation',
    ORDER_SHIPPED: 'order_shipped',
    ORDER_DELIVERED: 'order_delivered',
    ORDER_CANCELLED: 'order_cancelled',
};

// Image Configuration
const IMAGE_CONFIG = {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    THUMBNAIL_SIZE: { width: 150, height: 150 },
    MEDIUM_SIZE: { width: 500, height: 500 },
    LARGE_SIZE: { width: 1200, height: 1200 },
};

// Coupon Types
const COUPON_TYPES = {
    PERCENTAGE: 'percentage',
    FIXED: 'fixed',
    FREE_SHIPPING: 'free_shipping',
};

// Review Status
const REVIEW_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
};

// Notification Types
const NOTIFICATION_TYPES = {
    ORDER_UPDATE: 'order_update',
    PAYMENT_UPDATE: 'payment_update',
    SHIPPING_UPDATE: 'shipping_update',
    PROMOTION: 'promotion',
    SYSTEM: 'system',
};

// Error Codes
const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE_ERROR: 'DUPLICATE_ERROR',
    PAYMENT_ERROR: 'PAYMENT_ERROR',
    STOCK_ERROR: 'STOCK_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
};

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};

// Rate Limiting
const RATE_LIMITS = {
    GENERAL: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 100,
    },
    AUTH: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 5,
    },
    API: {
        WINDOW_MS: 60 * 1000, // 1 minute
        MAX_REQUESTS: 60,
    },
};

// Cache TTL (Time To Live)
const CACHE_TTL = {
    SHORT: 60, // 1 minute
    MEDIUM: 300, // 5 minutes
    LONG: 3600, // 1 hour
    VERY_LONG: 86400, // 24 hours
};

// Timezone
const TIMEZONE = {
    IST_OFFSET: 5.5 * 60 * 60 * 1000, // IST is UTC+5:30
};

module.exports = {
    TAX_RATES,
    SHIPPING,
    ORDER_STATUS,
    PAYMENT_STATUS,
    PAYMENT_METHODS,
    SHIPPING_STATUS,
    USER_ROLES,
    PAGINATION,
    PRODUCT_STATUS,
    STOCK_STATUS,
    STOCK_THRESHOLDS,
    ANALYTICS_EVENTS,
    DEVICE_TYPES,
    COOKIES,
    TIME_PERIODS,
    DATE_FORMATS,
    EMAIL_TYPES,
    IMAGE_CONFIG,
    COUPON_TYPES,
    REVIEW_STATUS,
    NOTIFICATION_TYPES,
    ERROR_CODES,
    HTTP_STATUS,
    RATE_LIMITS,
    CACHE_TTL,
    TIMEZONE,
};
