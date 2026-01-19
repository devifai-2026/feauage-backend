const StockHistory = require('../../models/StockHistory');
const Product = require('../../models/Product');
const AdminActivity = require('../../models/AdminActivity');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');

// @desc    Get all stock history
// @route   GET /api/v1/admin/stock/history
// @access  Private/Admin
exports.getStockHistory = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(StockHistory.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  const stockHistory = await features.query
    .populate('product', 'name sku')
    .populate('performedBy', 'firstName lastName')
    .populate('referenceId')
    .sort('-performedAt');
  
  const total = await StockHistory.countDocuments(features.filterQuery);
  
  res.status(200).json({
    status: 'success',
    results: stockHistory.length,
    total,
    data: {
      stockHistory
    }
  });
});

// @desc    Get stock statistics
// @route   GET /api/v1/admin/stock/statistics
// @access  Private/Admin
exports.getStockStatistics = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  const matchStage = {};
  if (startDate && endDate) {
    matchStage.performedAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  // Get stock movement summary
  const stockSummary = await StockHistory.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        totalQuantity: { $sum: '$quantity' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalQuantity: -1 } }
  ]);
  
  // Get top products by stock movement
  const topProducts = await StockHistory.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$product',
        totalMovement: { $sum: '$quantity' },
        inCount: {
          $sum: { $cond: [{ $in: ['$type', ['stock_in', 'return']] }, '$quantity', 0] }
        },
        outCount: {
          $sum: { $cond: [{ $in: ['$type', ['stock_out', 'damaged']] }, '$quantity', 0] }
        }
      }
    },
    { $sort: { totalMovement: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $project: {
        productId: '$_id',
        productName: '$product.name',
        productSku: '$product.sku',
        totalMovement: 1,
        inCount: 1,
        outCount: 1,
        currentStock: '$product.stockQuantity',
        _id: 0
      }
    }
  ]);
  
  // Get current stock status
  const stockStatus = await Product.aggregate([
    {
      $group: {
        _id: '$stockStatus',
        count: { $sum: 1 },
        totalStock: { $sum: '$stockQuantity' }
      }
    }
  ]);
  
  // Get low stock alerts
  const lowStockProducts = await Product.find({
    stockStatus: 'low_stock',
    isActive: true
  })
  .select('name sku stockQuantity lowStockThreshold sellingPrice')
  .sort('stockQuantity')
  .limit(20);
  
  res.status(200).json({
    status: 'success',
    data: {
      summary: stockSummary,
      topProducts,
      stockStatus,
      lowStockProducts: {
        count: lowStockProducts.length,
        products: lowStockProducts
      }
    }
  });
});

// @desc    Bulk update stock
// @route   POST /api/v1/admin/stock/bulk-update
// @access  Private/Admin
exports.bulkUpdateStock = catchAsync(async (req, res, next) => {
  const { updates } = req.body;
  
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return next(new AppError('Stock updates are required', 400));
  }
  
  const results = [];
  const errors = [];
  
  for (const update of updates) {
    try {
      const { productId, quantity, type, reason, notes } = update;
      
      if (!['stock_in', 'stock_out', 'adjustment'].includes(type)) {
        errors.push({
          productId,
          error: 'Invalid stock update type'
        });
        continue;
      }
      
      const product = await Product.updateStock(
        productId,
        quantity,
        type,
        req.user.id,
        null,
        reason || 'Bulk stock update',
        notes
      );
      
      results.push({
        productId,
        success: true,
        newStock: product.stockQuantity
      });
    } catch (error) {
      errors.push({
        productId: update.productId,
        error: error.message
      });
    }
  }
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'Stock',
    metadata: {
      updateCount: updates.length,
      successCount: results.length,
      errorCount: errors.length
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      results,
      errors,
      summary: {
        total: updates.length,
        success: results.length,
        failed: errors.length
      }
    }
  });
});

// @desc    Get stock alerts
// @route   GET /api/v1/admin/stock/alerts
// @access  Private/Admin
exports.getStockAlerts = catchAsync(async (req, res, next) => {
  const { threshold } = req.query;
  const alertThreshold = threshold || 10;
  
  const alertProducts = await Product.find({
    stockQuantity: { $lte: alertThreshold },
    isActive: true
  })
  .select('name sku stockQuantity lowStockThreshold sellingPrice images')
  .populate('images')
  .sort('stockQuantity');
  
  res.status(200).json({
    status: 'success',
    results: alertProducts.length,
    data: {
      products: alertProducts,
      alertThreshold
    }
  });
});

// @desc    Export stock report
// @route   GET /api/v1/admin/stock/export
// @access  Private/Admin
exports.exportStockReport = catchAsync(async (req, res, next) => {
  const { includeInactive } = req.query;
  
  const query = {};
  if (!includeInactive) {
    query.isActive = true;
  }
  
  const products = await Product.find(query)
    .select('name sku stockQuantity lowStockThreshold stockStatus sellingPrice category')
    .populate('category', 'name')
    .sort('stockQuantity');
  
  // Format for export
  const exportData = products.map(product => ({
    'Product Name': product.name,
    'SKU': product.sku,
    'Stock Quantity': product.stockQuantity,
    'Low Stock Threshold': product.lowStockThreshold,
    'Stock Status': product.stockStatus,
    'Selling Price': product.sellingPrice,
    'Category': product.category?.name || 'N/A',
    'Status': product.isActive ? 'Active' : 'Inactive'
  }));
  
  res.status(200).json({
    status: 'success',
    data: {
      products: exportData,
      count: products.length,
      summary: {
        totalStock: products.reduce((sum, p) => sum + p.stockQuantity, 0),
        lowStock: products.filter(p => p.stockStatus === 'low_stock').length,
        outOfStock: products.filter(p => p.stockStatus === 'out_of_stock').length,
        inStock: products.filter(p => p.stockStatus === 'in_stock').length
      }
    }
  });
});