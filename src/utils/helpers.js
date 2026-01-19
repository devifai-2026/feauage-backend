const crypto = require('crypto');

// Generate random string
exports.generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Format currency
exports.formatCurrency = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency
  }).format(amount);
};

// Format date
exports.formatDate = (date, format = 'short') => {
  const dateObj = new Date(date);
  
  if (format === 'short') {
    return dateObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
  
  if (format === 'long') {
    return dateObj.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  return dateObj.toISOString();
};

// Calculate discount percentage
exports.calculateDiscountPercentage = (originalPrice, discountedPrice) => {
  if (originalPrice <= 0) return 0;
  const discount = originalPrice - discountedPrice;
  return Math.round((discount / originalPrice) * 100);
};

// Generate order number
exports.generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `ORD${year}${month}${day}${random}`;
};

// Generate SKU
exports.generateSKU = (category, count) => {
  const categoryCode = category.substring(0, 3).toUpperCase();
  return `${categoryCode}-${String(count + 1).padStart(4, '0')}`;
};

// Validate email
exports.isValidEmail = (email) => {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
};

// Validate phone number (Indian)
exports.isValidPhone = (phone) => {
  const re = /^[6-9]\d{9}$/;
  return re.test(phone);
};

// Validate pincode (Indian)
exports.isValidPincode = (pincode) => {
  const re = /^[1-9][0-9]{5}$/;
  return re.test(pincode);
};

// Truncate string
exports.truncateString = (str, length = 100) => {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
};

// Generate slug from string
exports.generateSlug = (str) => {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
};

// Calculate shipping charge
exports.calculateShippingCharge = (pincode, orderValue) => {
  // Simplified calculation - integrate with shipping API in production
  if (orderValue >= 5000) return 0;
  
  const metroPincodes = ['400001', '110001', '600001', '700001', '500001', '560001'];
  if (metroPincodes.includes(pincode.substring(0, 6))) {
    return 50;
  }
  
  return 100;
};

// Generate invoice number
exports.generateInvoiceNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `INV${year}${month}${day}${random}`;
};

// Calculate tax (18% GST)
exports.calculateTax = (amount) => {
  return amount * 0.18;
};

// Format file size
exports.formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};