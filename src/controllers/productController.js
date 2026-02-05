const Product = require('../models/Product');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Review = require('../models/Review');
const Analytics = require('../models/Analytics');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

// @desc    Get all products
// @route   GET /api/v1/products
// @access  Public
exports.getAllProducts = catchAsync(async (req, res, next) => {
  // Build query
  const features = new APIFeatures(
    Product.find({ isActive: true }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  // Execute query
  const products = await features.query
    .populate('category', 'name slug')
    .populate('subCategory', 'name slug')
    .populate('images');
  
  // Get total count
  const total = await Product.countDocuments({
    isActive: true,
    ...features.filterQuery
  });
  
  res.status(200).json({
    status: 'success',
    results: products.length,
    total,
    data: {
      products
    }
  });
});

// @desc    Get single product
// @route   GET /api/v1/products/:id
// @access  Public
exports.getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name slug')
    .populate('subCategory', 'name slug')
    .populate('images')
    .populate('gemstones')
    .populate({
      path: 'reviews',
      options: { sort: { createdAt: -1 } },
      populate: {
        path: 'user',
        select: 'firstName lastName profileImage'
      }
    });
  
  if (!product || !product.isActive) {
    return next(new AppError('Product not found', 404));
  }

  // Self-healing: Update ratings if they are out of sync
  if (product.reviews && product.ratingCount !== product.reviews.length) {
    await Review.updateProductRatings(product._id);
    // Reload the product object to get updated stats
    const updatedStats = await Product.findById(product._id).select('ratingAverage ratingCount');
    product.ratingAverage = updatedStats.ratingAverage;
    product.ratingCount = updatedStats.ratingCount;
  }
  
  // Increment view count
  product.viewCount += 1;
  await product.save();
  
  // Log analytics
  if (req.user) {
    await Analytics.create({
      type: 'product_view',
      entityId: product._id,
      entityType: 'Product',
      user: req.user._id,
      sessionId: req.sessionID || 'anonymous',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      referrer: req.get('referrer')
    });
  }
  
  // Get related products
  const relatedProducts = await Product.find({
    _id: { $ne: product._id },
    category: product.category,
    isActive: true
  })
  .limit(4)
  .select('name slug sellingPrice offerPrice isOnOffer images ratingAverage stockStatus stockQuantity')
  .populate('images');
  
  res.status(200).json({
    status: 'success',
    data: {
      product,
      relatedProducts
    }
  });
});

// @desc    Create product
// @route   POST /api/v1/products
// @access  Private/Admin
exports.createProduct = catchAsync(async (req, res, next) => {
  // Check if category exists
  const category = await Category.findById(req.body.category);
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  // Check if subcategory exists
  if (req.body.subCategory) {
    const subCategory = await SubCategory.findById(req.body.subCategory);
    if (!subCategory) {
      return next(new AppError('Subcategory not found', 404));
    }
  }
  
  // Generate SKU if not provided
  if (!req.body.sku) {
    const categoryCode = category.name.substring(0, 3).toUpperCase();
    const count = await Product.countDocuments({ category: req.body.category });
    req.body.sku = `${categoryCode}-${String(count + 1).padStart(4, '0')}`;
  }
  
  // Set createdBy
  req.body.createdBy = req.user.id;
  
  const product = await Product.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: {
      product
    }
  });
});

// @desc    Update product
// @route   PATCH /api/v1/products/:id
// @access  Private/Admin
exports.updateProduct = catchAsync(async (req, res, next) => {
  // Check if product exists
  let product = await Product.findById(req.params.id);
  if (!product) {
    return next(new AppError('Product not found', 404));
  }
  
  // Check if category exists if being updated
  if (req.body.category) {
    const category = await Category.findById(req.body.category);
    if (!category) {
      return next(new AppError('Category not found', 404));
    }
  }
  
  // Check if subcategory exists if being updated
  if (req.body.subCategory) {
    const subCategory = await SubCategory.findById(req.body.subCategory);
    if (!subCategory) {
      return next(new AppError('Subcategory not found', 404));
    }
  }
  
  // Update updatedBy
  req.body.updatedBy = req.user.id;
  
  // Update product
  product = await Product.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  res.status(200).json({
    status: 'success',
    data: {
      product
    }
  });
});

// @desc    Delete product
// @route   DELETE /api/v1/products/:id
// @access  Private/Admin
exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    return next(new AppError('Product not found', 404));
  }
  
  // Soft delete - set isActive to false
  product.isActive = false;
  await product.save();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Get product reviews
// @route   GET /api/v1/products/:id/reviews
// @access  Public
exports.getProductReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find({ 
    product: req.params.id
  })
    .populate('user', 'firstName lastName profileImage')
    .sort('-createdAt');
  
  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      reviews
    }
  });
});

// @desc    Search products
// @route   GET /api/v1/products/search
// @access  Public
exports.searchProducts = catchAsync(async (req, res, next) => {
  const { q, category, minPrice, maxPrice, material, gender, sort, page = 1, limit = 20 } = req.query;
  
  const query = { isActive: true };
  
  // Text search
  if (q) {
    query.$text = { $search: q };
  }
  
  // Category filter
  if (category) {
    query.category = category;
  }
  
  // Price range
  if (minPrice || maxPrice) {
    query.$or = [
      { offerPrice: {} },
      { sellingPrice: {} }
    ];
    
    if (minPrice) {
      query.$or[0].offerPrice.$gte = Number(minPrice);
      query.$or[1].sellingPrice.$gte = Number(minPrice);
    }
    if (maxPrice) {
      query.$or[0].offerPrice.$lte = Number(maxPrice);
      query.$or[1].sellingPrice.$lte = Number(maxPrice);
    }
  }
  
  // Material filter
  if (material) {
    query.material = material;
  }
  
  // Gender filter
  if (gender) {
    query.gender = gender;
  }
  
  // Sort options
  let sortOption = '-createdAt';
  switch (sort) {
    case 'price_asc':
      sortOption = 'sellingPrice';
      break;
    case 'price_desc':
      sortOption = '-sellingPrice';
      break;
    case 'rating':
      sortOption = '-ratingAverage';
      break;
    case 'popular':
      sortOption = '-purchaseCount';
      break;
    case 'newest':
      sortOption = '-createdAt';
      break;
    case 'discount':
      sortOption = '-discountValue';
      break;
  }
  
  // Pagination
  const skip = (page - 1) * limit;
  
  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('category', 'name slug')
      .populate('images'),
    Product.countDocuments(query)
  ]);
  
  // Log search analytics
  if (q) {
    await Analytics.create({
      type: 'search',
      metadata: { query: q, filters: req.query },
      sessionId: req.sessionID || 'anonymous',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      referrer: req.get('referrer')
    });
  }
  
  res.status(200).json({
    status: 'success',
    results: products.length,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
    data: {
      products
    }
  });
});

// @desc    Get featured products
// @route   GET /api/v1/products/featured
// @access  Public
exports.getFeaturedProducts = catchAsync(async (req, res, next) => {
  const products = await Product.find({
    isActive: true,
    isFeatured: true
  })
  .limit(10)
  .select('name slug sellingPrice offerPrice isOnOffer images ratingAverage stockStatus stockQuantity')
  .populate('images');
  
  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      products
    }
  });
});

// @desc    Get new arrivals
// @route   GET /api/v1/products/new-arrivals
// @access  Public
exports.getNewArrivals = catchAsync(async (req, res, next) => {
  const products = await Product.find({
    isActive: true,
    isNewArrival: true
  })
  .limit(10)
  .select('name slug sellingPrice offerPrice isOnOffer images ratingAverage stockStatus stockQuantity')
  .populate('images');
  
  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      products
    }
  });
});

// @desc    Get best sellers
// @route   GET /api/v1/products/best-sellers
// @access  Public
exports.getBestSellers = catchAsync(async (req, res, next) => {
  const products = await Product.find({
    isActive: true,
    isBestSeller: true
  })
  .limit(10)
  .select('name slug sellingPrice offerPrice isOnOffer images ratingAverage purchaseCount stockStatus stockQuantity')
  .populate('images');
  
  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      products
    }
  });
});

// @desc    Get products on sale
// @route   GET /api/v1/products/on-sale
// @access  Public
exports.getProductsOnSale = catchAsync(async (req, res, next) => {
  const products = await Product.find({
    isActive: true,
    isOnOffer: true,
    offerStartDate: { $lte: new Date() },
    offerEndDate: { $gte: new Date() }
  })
  .limit(10)
  .select('name slug sellingPrice offerPrice discountValue discountType images stockStatus stockQuantity')
  .populate('images');
  
  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      products
    }
  });
});

// @desc    Get products by category
// @route   GET /api/v1/products/category/:categorySlug
// @access  Public
exports.getProductsByCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findOne({ slug: req.params.categorySlug });
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  const features = new APIFeatures(
    Product.find({ 
      category: category._id,
      isActive: true 
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const products = await features.query
    .populate('images')
    .populate('subCategory', 'name slug');
  
  const total = await Product.countDocuments({
    category: category._id,
    isActive: true,
    ...features.filterQuery
  });
  
  // Log category view analytics
  await Analytics.create({
    type: 'category_view',
    entityId: category._id,
    entityType: 'Category',
    sessionId: req.sessionID || 'anonymous',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    referrer: req.get('referrer')
  });
  
  res.status(200).json({
    status: 'success',
    results: products.length,
    total,
    data: {
      category,
      products
    }
  });
});

// @desc    Get similar products
// @route   GET /api/v1/products/:id/similar
// @access  Public
exports.getSimilarProducts = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    return next(new AppError('Product not found', 404));
  }
  
  const similarProducts = await Product.find({
    _id: { $ne: product._id },
    $or: [
      { category: product.category },
      { material: product.material },
      { tags: { $in: product.tags } }
    ],
    isActive: true
  })
  .limit(8)
  .select('name slug sellingPrice offerPrice isOnOffer images ratingAverage stockStatus stockQuantity')
  .populate('images');
  
  res.status(200).json({
    status: 'success',
    results: similarProducts.length,
    data: {
      products: similarProducts
    }
  });
});

// @desc    Get product filters
// @route   GET /api/v1/products/filters
// @access  Public
exports.getProductFilters = catchAsync(async (req, res, next) => {
  const filters = {
    materials: await Product.distinct('material', { isActive: true }),
    categories: await Category.find({ isActive: true }).select('name slug'),
    priceRange: await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$sellingPrice' },
          maxPrice: { $max: '$sellingPrice' }
        }
      }
    ])
  };
  
  res.status(200).json({
    status: 'success',
    data: {
      filters
    }
  });
});