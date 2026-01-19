const validator = require('validator');

// Product validators
exports.validateProduct = (data) => {
  const errors = [];
  
  if (!data.name || data.name.trim().length < 3) {
    errors.push('Product name must be at least 3 characters');
  }
  
  if (!data.description || data.description.trim().length < 50) {
    errors.push('Description must be at least 50 characters');
  }
  
  if (!data.category) {
    errors.push('Category is required');
  }
  
  if (!data.basePrice || data.basePrice < 0) {
    errors.push('Base price must be a positive number');
  }
  
  if (!data.sellingPrice || data.sellingPrice < 0) {
    errors.push('Selling price must be a positive number');
  }
  
  if (data.discountType === 'percentage' && data.discountValue > 100) {
    errors.push('Percentage discount cannot exceed 100%');
  }
  
  if (data.stockQuantity < 0) {
    errors.push('Stock quantity cannot be negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// User validators
exports.validateUser = (data) => {
  const errors = [];
  
  if (!data.email || !validator.isEmail(data.email)) {
    errors.push('Valid email is required');
  }
  
  if (!data.password || data.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.push('First name must be at least 2 characters');
  }
  
  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.push('Last name must be at least 2 characters');
  }
  
  if (data.phone && !/^[0-9]{10}$/.test(data.phone)) {
    errors.push('Phone number must be 10 digits');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Order validators
exports.validateOrder = (data) => {
  const errors = [];
  
  if (!data.shippingAddressId) {
    errors.push('Shipping address is required');
  }
  
  if (!data.paymentMethod) {
    errors.push('Payment method is required');
  }
  
  const validPaymentMethods = ['razorpay', 'cod', 'card', 'wallet', 'netbanking', 'upi'];
  if (!validPaymentMethods.includes(data.paymentMethod)) {
    errors.push('Invalid payment method');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Address validators
exports.validateAddress = (data) => {
  const errors = [];
  
  if (!data.addressLine1 || data.addressLine1.trim().length < 5) {
    errors.push('Address line 1 must be at least 5 characters');
  }
  
  if (!data.city || data.city.trim().length < 2) {
    errors.push('City is required');
  }
  
  if (!data.state || data.state.trim().length < 2) {
    errors.push('State is required');
  }
  
  if (!data.pincode || !/^[1-9][0-9]{5}$/.test(data.pincode)) {
    errors.push('Valid Indian pincode is required');
  }
  
  if (!data.phone || !/^[0-9]{10}$/.test(data.phone)) {
    errors.push('Valid phone number is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Coupon validators
exports.validateCoupon = (data) => {
  const errors = [];
  
  if (!data.code || data.code.trim().length < 3) {
    errors.push('Coupon code must be at least 3 characters');
  }
  
  if (!data.name || data.name.trim().length < 3) {
    errors.push('Coupon name must be at least 3 characters');
  }
  
  if (!data.discountType || !['percentage', 'fixed'].includes(data.discountType)) {
    errors.push('Valid discount type is required');
  }
  
  if (!data.discountValue || data.discountValue < 0) {
    errors.push('Discount value must be a positive number');
  }
  
  if (data.discountType === 'percentage' && data.discountValue > 100) {
    errors.push('Percentage discount cannot exceed 100%');
  }
  
  if (!data.validFrom || !validator.isDate(data.validFrom)) {
    errors.push('Valid from date is required');
  }
  
  if (!data.validUntil || !validator.isDate(data.validUntil)) {
    errors.push('Valid until date is required');
  }
  
  if (new Date(data.validUntil) <= new Date(data.validFrom)) {
    errors.push('Valid until date must be after valid from date');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Review validators
exports.validateReview = (data) => {
  const errors = [];
  
  if (!data.productId) {
    errors.push('Product ID is required');
  }
  
  if (!data.rating || data.rating < 1 || data.rating > 5) {
    errors.push('Rating must be between 1 and 5');
  }
  
  if (!data.comment || data.comment.trim().length < 10) {
    errors.push('Comment must be at least 10 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};