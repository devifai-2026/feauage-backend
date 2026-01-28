const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhook');
const targetRoutes = require('./routes/targetRoutes');
const adminUserRoutes = require('./routes/adminUsers');
const guestRoutes = require('./routes/guest');
const bannerRoutes = require('./routes/banners');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/appError');

const app = express();

// 1) GLOBAL MIDDLEWARES

// Implement CORS

app.use(cors({
  origin: true, // Allows all origins (for testing only!)
  credentials: true
}));

// Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:']
    }
  }
}));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
// const limiter = rateLimit({
//   max: 100,
//   windowMs: 60 * 60 * 1000,
//   message: 'Too many requests from this IP, please try again in an hour!'
// });
// app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: [
    'price',
    'rating',
    'category',
    'material',
    'gender',
    'sort'
  ]
}));

// Compression
app.use(compression());

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// 2) ROUTES
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin/users', adminUserRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/targets', targetRoutes);
app.use('/api/v1/guest', guestRoutes);
app.use('/api/v1/banners', bannerRoutes);

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Route to list all endpoints
app.get('/api/v1/endpoints', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const endpoints = [];

  function processStack(stack, path = '') {
    stack.forEach((middleware) => {
      if (middleware.route) {
        // Regular route
        const methods = Object.keys(middleware.route.methods)
          .map(method => method.toUpperCase())
          .join(', ');
        const routePath = path + middleware.route.path;
        endpoints.push({
          method: methods,
          path: routePath,
          fullUrl: `${baseUrl}${routePath}`,
          apiPath: routePath
        });
      } else if (middleware.name === 'router' || middleware.name === 'bound dispatch') {
        // Router middleware
        if (middleware.handle && middleware.handle.stack) {
          const routerPath = path + (middleware.regexp.source === '^\\/?(?=\\/|$)' ? '' : '');
          processStack(middleware.handle.stack, routerPath);
        }
      }
    });
  }

  processStack(app._router.stack);

  res.status(200).json({
    status: 'success',
    baseUrl: baseUrl,
    count: endpoints.length,
    endpoints: endpoints,
    timestamp: new Date().toISOString()
  });
});

// 3) ERROR HANDLING
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(errorHandler);

// Export the function to get routes for server.js
app.getRegisteredRoutes = function () {
  const routes = [];
  const baseUrl = `http://localhost:${process.env.PORT || 5000}`;

  function processStack(stack, path = '') {
    stack.forEach((middleware) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods)
          .map(method => method.toUpperCase())
          .join(', ');
        const routePath = path + middleware.route.path;
        routes.push({
          method: methods,
          path: routePath,
          fullUrl: `${baseUrl}${routePath}`
        });
      } else if (middleware.name === 'router' || middleware.name === 'bound dispatch') {
        if (middleware.handle && middleware.handle.stack) {
          const routerPath = path + (middleware.regexp.source === '^\\/?(?=\\/|$)' ? '' : '');
          processStack(middleware.handle.stack, routerPath);
        }
      }
    });
  }

  processStack(app._router.stack);
  return routes;
};

module.exports = app;