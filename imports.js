// This file shows how to import and use all models and controllers

// Import Models
const User = require('./models/User');
const Product = require('./models/Product');
const Category = require('./models/Category');
const Order = require('./models/Order');
const Cart = require('./models/Cart');
const Wishlist = require('./models/Wishlist');
const Review = require('./models/Review');
const Coupon = require('./models/Coupon');
const Banner = require('./models/Banner');
const StockHistory = require('./models/StockHistory');
const Analytics = require('./models/Analytics');

// Import Controllers
const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const productController = require('./controllers/productController');
const orderController = require('./controllers/orderController');
const cartController = require('./controllers/cartController');
const wishlistController = require('./controllers/wishlistController');

// Import Admin Controllers
const adminProductController = require('./controllers/admin/productController');
const adminOrderController = require('./controllers/admin/orderController');
const adminCategoryController = require('./controllers/admin/categoryController');
const adminDashboardController = require('./controllers/admin/dashboardController');

// Import Services
const emailService = require('./services/emailService');
const paymentService = require('./services/paymentService');
const shippingService = require('./services/shippingService');
const stockService = require('./services/stockService');

// Import Utils
const catchAsync = require('./utils/catchAsync');
const AppError = require('./utils/appError');
const APIFeatures = require('./utils/apiFeatures');

// Import Middleware
const auth = require('./middleware/auth');
const upload = require('./middleware/upload');
const validate = require('./middleware/validate');

// Example usage:
exports.createUser = async (userData) => {
  try {
    const user = await User.create(userData);
    return user;
  } catch (error) {
    throw new AppError(error.message, 400);
  }
};

exports.getProducts = async (query) => {
  const features = new APIFeatures(Product.find(), query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const products = await features.query;
  return products;
};

exports.createOrder = async (orderData, userId) => {
  return await orderController.createOrder(orderData, userId);
};

// Socket.io integration example
const { initializeSocket, emitOrderNotification } = require('./sockets/orderSocket');

// Export everything
module.exports = {
  // Models
  User,
  Product,
  Category,
  Order,
  Cart,
  Wishlist,
  Review,
  Coupon,
  Banner,
  StockHistory,
  Analytics,
  
  // Controllers
  authController,
  userController,
  productController,
  orderController,
  cartController,
  wishlistController,
  adminProductController,
  adminOrderController,
  adminCategoryController,
  adminDashboardController,
  
  // Services
  emailService,
  paymentService,
  shippingService,
  stockService,
  
  // Utils
  catchAsync,
  AppError,
  APIFeatures,
  
  // Middleware
  auth,
  upload,
  validate,
  
  // Socket
  initializeSocket,
  emitOrderNotification
};