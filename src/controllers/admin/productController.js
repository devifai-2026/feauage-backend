const Product = require('../../models/Product');
const Category = require('../../models/Category');
const SubCategory = require('../../models/SubCategory');
const ProductImage = require('../../models/ProductImage');
const ProductGemstone = require('../../models/ProductGemstone');
const StockHistory = require('../../models/StockHistory');
const AdminActivity = require('../../models/AdminActivity');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');

// @desc    Get all products (admin view)
// @route   GET /api/v1/admin/products
// @access  Private/Admin
exports.getAllProducts = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Product.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const products = await features.query
    .populate('category', 'name')
    .populate('subCategory', 'name')
    .populate('createdBy', 'firstName lastName')
    .populate('images')
    .populate('gemstones');

  const total = await Product.countDocuments(features.filterQuery);

  res.status(200).json({
    status: 'success',
    results: products.length,
    total,
    data: {
      products
    }
  });
});

// @desc    Get single product (admin view)
// @route   GET /api/v1/admin/products/:id
// @access  Private/Admin
exports.getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name')
    .populate('subCategory', 'name')
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .populate('images')
    .populate('gemstones');

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      product
    }
  });
});

// @desc    Create product (admin)
// @route   POST /api/v1/admin/products
// @access  Private/Admin
exports.createProduct = catchAsync(async (req, res, next) => {
  // Check if category exists
  const category = await Category.findById(req.body.category);
  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  // Handle empty subcategory
  if (req.body.subCategory === '') {
    req.body.subCategory = undefined;
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

  // Ensure mandatory fields are present in req.body for better error handling before Product.create
  const requiredFields = ['name', 'description', 'category', 'basePrice', 'sellingPrice', 'stockQuantity', 'material'];
  const missingFields = requiredFields.filter(field => !req.body[field] && req.body[field] !== 0);

  if (missingFields.length > 0) {
    return next(new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400));
  }

  // Set defaults and handle enums if needed
  if (!req.body.gender) req.body.gender = 'unisex';

  const product = await Product.create(req.body);

  // Handle images if provided in the body
  if (req.body.images && Array.isArray(req.body.images)) {
    const imagePromises = req.body.images.map(img =>
      ProductImage.create({
        product: product._id,
        url: img.url,
        isPrimary: img.isPrimary || false,
        uploadedBy: req.user.id
      })
    );
    await Promise.all(imagePromises);
  }

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'create',
    entityType: 'Product',
    entityId: product._id,
    newState: product.toObject(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(201).json({
    status: 'success',
    data: {
      product
    }
  });
});

// @desc    Update product (admin)
// @route   PATCH /api/v1/admin/products/:id
// @access  Private/Admin
exports.updateProduct = catchAsync(async (req, res, next) => {
  // Get previous state
  const previousProduct = await Product.findById(req.params.id);
  if (!previousProduct) {
    return next(new AppError('Product not found', 404));
  }

  // Check if category exists if being updated
  if (req.body.category) {
    const category = await Category.findById(req.body.category);
    if (!category) {
      return next(new AppError('Category not found', 404));
    }
  }

  // Handle empty subcategory
  if (req.body.subCategory === '') {
    req.body.subCategory = undefined;
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

  // Update product properties
  Object.assign(previousProduct, req.body);
  const product = await previousProduct.save();

  // Handle images update if provided
  if (req.body.images && Array.isArray(req.body.images)) {
    console.log('hitting', req.body.images)
    // Basic implementation: replace all images
    await ProductImage.deleteMany({ product: product._id });

    const imagePromises = req.body.images.map(img =>
      ProductImage.create({
        product: product._id,
        url: img.url,
        isPrimary: img.isPrimary || false,
        uploadedBy: req.user.id
      })
    );
    await Promise.all(imagePromises);
  }

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'Product',
    entityId: product._id,
    previousState: previousProduct.toObject(),
    newState: product.toObject(),
    changes: req.body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(200).json({
    status: 'success',
    data: {
      product
    }
  });
});

// @desc    Delete product (admin)
// @route   DELETE /api/v1/admin/products/:id
// @access  Private/Admin
exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Soft delete - set isActive to false
  product.isActive = false;
  await product.save();

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'delete',
    entityType: 'Product',
    entityId: product._id,
    previousState: product.toObject(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Get product stock history
// @route   GET /api/v1/admin/products/:id/stock-history
// @access  Private/Admin
exports.getStockHistory = catchAsync(async (req, res, next) => {
  const stockHistory = await StockHistory.find({ product: req.params.id })
    .populate('performedBy', 'firstName lastName email')
    .sort('-performedAt');

  res.status(200).json({
    status: 'success',
    results: stockHistory.length,
    data: {
      stockHistory
    }
  });
});

// @desc    Update product stock (admin)
// @route   PATCH /api/v1/admin/products/:id/stock
// @access  Private/Admin
exports.updateStock = catchAsync(async (req, res, next) => {
  const { quantity, type, reason, notes } = req.body;

  if (!['stock_in', 'stock_out', 'adjustment'].includes(type)) {
    return next(new AppError('Invalid stock update type', 400));
  }

  if (!quantity || quantity <= 0) {
    return next(new AppError('Quantity must be greater than 0', 400));
  }

  const product = await Product.updateStock(
    req.params.id,
    quantity,
    type,
    req.user.id,
    null,
    reason || 'Manual stock update',
    notes
  );

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'Stock',
    entityId: product._id,
    metadata: {
      type,
      quantity,
      reason,
      previousStock: product.stockQuantity - (type === 'stock_in' ? quantity : -quantity),
      newStock: product.stockQuantity
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(200).json({
    status: 'success',
    data: {
      product
    }
  });
});

// @desc    Get low stock products
// @route   GET /api/v1/admin/products/low-stock
// @access  Private/Admin
exports.getLowStockProducts = catchAsync(async (req, res, next) => {
  const products = await Product.find({
    stockStatus: 'low_stock',
    isActive: true
  })
    .select('name sku stockQuantity lowStockThreshold sellingPrice images')
    .populate('images')
    .sort('stockQuantity');

  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      products
    }
  });
});

// @desc    Get out of stock products
// @route   GET /api/v1/admin/products/out-of-stock
// @access  Private/Admin
exports.getOutOfStockProducts = catchAsync(async (req, res, next) => {
  const products = await Product.find({
    stockStatus: 'out_of_stock',
    isActive: true
  })
    .select('name sku stockQuantity sellingPrice images')
    .populate('images')
    .sort('name');

  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      products
    }
  });
});

// @desc    Bulk update products
// @route   POST /api/v1/admin/products/bulk-update
// @access  Private/Admin
exports.bulkUpdateProducts = catchAsync(async (req, res, next) => {
  const { productIds, updates } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return next(new AppError('Product IDs are required', 400));
  }

  if (!updates || typeof updates !== 'object') {
    return next(new AppError('Updates are required', 400));
  }

  // Filter allowed updates
  const allowedUpdates = ['isActive', 'isFeatured', 'isNewArrival', 'isBestSeller', 'stockQuantity', 'sellingPrice', 'discountValue', 'discountType'];
  const filteredUpdates = {};

  Object.keys(updates).forEach(key => {
    if (allowedUpdates.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return next(new AppError('No valid updates provided', 400));
  }

  // Add updatedBy
  filteredUpdates.updatedBy = req.user.id;

  // Update products
  const result = await Product.updateMany(
    { _id: { $in: productIds } },
    { $set: filteredUpdates },
    { runValidators: true }
  );

  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'Product',
    metadata: {
      productCount: productIds.length,
      updates: filteredUpdates
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(200).json({
    status: 'success',
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount
    }
  });
});

// @desc    Upload product images
// @route   POST /api/v1/admin/products/:id/images
// @access  Private/Admin
exports.uploadProductImages = catchAsync(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(new AppError('Please upload at least one image', 400));
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  const images = [];

  for (const file of req.files) {
    const image = await ProductImage.create({
      product: product._id,
      url: file.location, // S3 URL
      altText: `Image of ${product.name}`,
      size: file.size,
      mimeType: file.mimetype,
      uploadedBy: req.user.id
    });

    images.push(image);
  }

  // Set first image as primary if no primary exists
  const primaryExists = await ProductImage.findOne({
    product: product._id,
    isPrimary: true
  });

  if (!primaryExists && images.length > 0) {
    images[0].isPrimary = true;
    await images[0].save();
  }

  res.status(201).json({
    status: 'success',
    data: {
      images
    }
  });
});

// @desc    Set primary image
// @route   PATCH /api/v1/admin/products/images/:imageId/set-primary
// @access  Private/Admin
exports.setPrimaryImage = catchAsync(async (req, res, next) => {
  const image = await ProductImage.findById(req.params.imageId);

  if (!image) {
    return next(new AppError('Image not found', 404));
  }

  image.isPrimary = true;
  await image.save();

  res.status(200).json({
    status: 'success',
    data: {
      image
    }
  });
});

// @desc    Delete product image
// @route   DELETE /api/v1/admin/products/images/:imageId
// @access  Private/Admin
exports.deleteProductImage = catchAsync(async (req, res, next) => {
  const image = await ProductImage.findById(req.params.imageId);

  if (!image) {
    return next(new AppError('Image not found', 404));
  }

  // Don't allow deletion if it's the only image
  const imageCount = await ProductImage.countDocuments({ product: image.product });

  if (imageCount <= 1) {
    return next(new AppError('Cannot delete the only image', 400));
  }

  await image.deleteOne();

  // If deleted image was primary, set another as primary
  if (image.isPrimary) {
    const newPrimary = await ProductImage.findOne({ product: image.product });
    if (newPrimary) {
      newPrimary.isPrimary = true;
      await newPrimary.save();
    }
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});