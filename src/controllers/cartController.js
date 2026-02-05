const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Analytics = require('../models/Analytics');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// @desc    Get user cart
// @route   GET /api/v1/cart
// @access  Private
exports.getCart = catchAsync(async (req, res, next) => {
  const query = req.user ? { user: req.user.id } : { guestId: req.guestId };
  const cart = await Cart.findOne(query)
    .populate({
      path: 'items',
      populate: {
        path: 'product',
        select: 'name slug sellingPrice offerPrice isOnOffer stockQuantity stockStatus images',
        populate: {
          path: 'images',
          match: { isPrimary: true }
        }
      }
    })
    .populate('couponApplied');
  
  if (!cart) {
    // Create cart if it doesn't exist
    const newCart = await Cart.create(req.user ? { user: req.user.id } : { guestId: req.guestId });
    return res.status(200).json({
      status: 'success',
      data: {
        cart: newCart
      }
    });
  }
  
  // Calculate totals
  await cart.calculateTotals();
  
  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

// @desc    Add item to cart
// @route   POST /api/v1/cart/items
// @access  Private
exports.addToCart = catchAsync(async (req, res, next) => {
  const { productId, quantity = 1 } = req.body;
  
  // Validate product
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(new AppError('Product not found', 404));
  }
  
  // Check stock availability
  if (product.stockQuantity < quantity) {
    return next(new AppError('Insufficient stock', 400));
  }
  
  // Get or create cart
  const query = req.user ? { user: req.user.id } : { guestId: req.guestId };
  let cart = await Cart.findOne(query);
  if (!cart) {
    cart = await Cart.create(query);
  }
  
  // Check if item already exists in cart
  const existingCartItem = await CartItem.findOne({
    cart: cart._id,
    product: productId
  });
  
  let cartItem;
  if (existingCartItem) {
    // Update quantity
    existingCartItem.quantity += quantity;
    cartItem = await existingCartItem.save();
  } else {
    // Create new cart item
    const price = product.isOnOffer ? product.offerPrice : product.sellingPrice;
    
    cartItem = await CartItem.create({
      cart: cart._id,
      product: productId,
      quantity,
      price
    });
    
    // Add to cart items array
    cart.items.push(cartItem._id);
    await cart.save();
  }
  
  // Calculate totals
  await cart.calculateTotals();
  
  // Log analytics
  await Analytics.create({
    type: 'add_to_cart',
    entityId: productId,
    entityType: 'Product',
    user: req.user ? req.user._id : null,
    guestId: req.guestId || null,
    sessionId: req.sessionID || 'anonymous',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { quantity }
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      cartItem,
      cart
    }
  });
});

// @desc    Update cart item quantity
// @route   PATCH /api/v1/cart/items/:itemId
// @access  Private
exports.updateCartItem = catchAsync(async (req, res, next) => {
  const { quantity } = req.body;
  
  if (!quantity || quantity < 1) {
    return next(new AppError('Quantity must be at least 1', 400));
  }
  
  // Find cart item
  const cartItem = await CartItem.findById(req.params.itemId)
    .populate('product', 'stockQuantity');
  
  if (!cartItem) {
    return next(new AppError('Cart item not found', 404));
  }
  
  // Verify cart belongs to user/guest
  const cart = await Cart.findById(cartItem.cart);
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  const isOwner = req.user 
    ? cart.user && cart.user.toString() === req.user.id 
    : cart.guestId === req.guestId;

  if (!isOwner) {
    return next(new AppError('Not authorized', 403));
  }
  
  // Check stock availability
  if (cartItem.product.stockQuantity < quantity) {
    return next(new AppError('Insufficient stock', 400));
  }
  
  // Update quantity
  cartItem.quantity = quantity;
  await cartItem.save();
  
  // Calculate totals
  await cart.calculateTotals();
  
  res.status(200).json({
    status: 'success',
    data: {
      cartItem,
      cart
    }
  });
});

// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/items/:itemId
// @access  Private
exports.removeCartItem = catchAsync(async (req, res, next) => {
  // Find cart item
  const cartItem = await CartItem.findById(req.params.itemId);
  
  if (!cartItem) {
    return next(new AppError('Cart item not found', 404));
  }
  
  // Verify cart belongs to user/guest
  const cart = await Cart.findById(cartItem.cart);
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  const isOwner = req.user 
    ? cart.user && cart.user.toString() === req.user.id 
    : cart.guestId === req.guestId;

  if (!isOwner) {
    return next(new AppError('Not authorized', 403));
  }
  
  // Remove item
  await cartItem.deleteOne();
  
  // Calculate totals
  await cart.calculateTotals();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Clear cart
// @route   DELETE /api/v1/cart
// @access  Private
exports.clearCart = catchAsync(async (req, res, next) => {
  const query = req.user ? { user: req.user.id } : { guestId: req.guestId };
  const cart = await Cart.findOne(query);
  
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }
  
  await cart.clearCart();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Apply coupon to cart
// @route   POST /api/v1/cart/apply-coupon
// @access  Private
exports.applyCoupon = catchAsync(async (req, res, next) => {
  const { couponCode } = req.body;
  
  // Find cart
  const query = req.user ? { user: req.user.id } : { guestId: req.guestId };
  let cart = await Cart.findOne(query)
    .populate('items')
    .populate('couponApplied');
  
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }
  
  // Calculate cart total first
  await cart.calculateTotals();
  
  // Find coupon
  const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
  if (!coupon) {
    return next(new AppError('Invalid coupon code', 400));
  }
  
  // Validate coupon
  const validation = coupon.validateCoupon(cart.cartTotal, req.user ? req.user.id : null);
  if (!validation.isValid) {
    return next(new AppError(validation.message, 400));
  }
  
  // Apply coupon
  cart.couponApplied = coupon._id;
  cart.discountTotal += validation.discountAmount;
  cart.grandTotal = cart.cartTotal - cart.discountTotal;
  
  // Ensure grand total is not negative
  if (cart.grandTotal < 0) {
    cart.grandTotal = 0;
  }
  
  await cart.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      cart,
      discount: validation.discountAmount,
      message: validation.message
    }
  });
});

// @desc    Remove coupon from cart
// @route   DELETE /api/v1/cart/remove-coupon
// @access  Private
exports.removeCoupon = catchAsync(async (req, res, next) => {
  const query = req.user ? { user: req.user.id } : { guestId: req.guestId };
  const cart = await Cart.findOne(query);
  
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }
  
  cart.couponApplied = null;
  await cart.calculateTotals();
  
  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

// @desc    Get cart count
// @route   GET /api/v1/cart/count
// @access  Private
exports.getCartCount = catchAsync(async (req, res, next) => {
  const query = req.user ? { user: req.user.id } : { guestId: req.guestId };
  const cart = await Cart.findOne(query).populate('items');
  
  const count = cart ? cart.items.length : 0;
  
  res.status(200).json({
    status: 'success',
    data: {
      count
    }
  });
});

// @desc    Check cart stock availability
// @route   GET /api/v1/cart/check-stock
// @access  Private
exports.checkCartStock = catchAsync(async (req, res, next) => {
  const query = req.user ? { user: req.user.id } : { guestId: req.guestId };
  const cart = await Cart.findOne(query)
    .populate({
      path: 'items',
      populate: {
        path: 'product',
        select: 'name stockQuantity stockStatus'
      }
    });
  
  if (!cart) {
    return res.status(200).json({
      status: 'success',
      data: {
        available: true,
        items: []
      }
    });
  }
  
  const unavailableItems = [];
  
  for (const item of cart.items) {
    if (item.product.stockQuantity < item.quantity) {
      unavailableItems.push({
        productId: item.product._id,
        productName: item.product.name,
        requested: item.quantity,
        available: item.product.stockQuantity,
        status: item.product.stockStatus
      });
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      available: unavailableItems.length === 0,
      unavailableItems
    }
  });
});