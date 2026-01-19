const Product = require('../models/Product');
const StockHistory = require('../models/StockHistory');
const NotificationService = require('./notificationService');

class StockService {
  // Update stock with history tracking
  static async updateStock(productId, quantity, type, userId, referenceId = null, reason = '', notes = '') {
    try {
      const product = await Product.findById(productId);
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      const previousStock = product.stockQuantity;
      let newStock;
      
      switch (type) {
        case 'stock_in':
          newStock = previousStock + quantity;
          break;
          
        case 'stock_out':
          if (previousStock < quantity) {
            throw new Error('Insufficient stock');
          }
          newStock = previousStock - quantity;
          break;
          
        case 'adjustment':
          newStock = quantity;
          break;
          
        case 'return':
          newStock = previousStock + quantity;
          break;
          
        case 'damaged':
          if (previousStock < quantity) {
            throw new Error('Insufficient stock for damage write-off');
          }
          newStock = previousStock - quantity;
          break;
          
        default:
          throw new Error('Invalid stock update type');
      }
      
      // Update product stock
      product.stockQuantity = newStock;
      
      // Update stock status
      if (newStock <= 0) {
        product.stockStatus = 'out_of_stock';
      } else if (newStock <= product.lowStockThreshold) {
        product.stockStatus = 'low_stock';
      } else {
        product.stockStatus = 'in_stock';
      }
      
      await product.save();
      
      // Create stock history record
      await StockHistory.create({
        product: productId,
        sku: product.sku,
        type,
        quantity: Math.abs(quantity),
        previousStock,
        newStock,
        reason,
        referenceId,
        referenceType: referenceId ? 'order' : 'manual',
        performedBy: userId,
        notes
      });
      
      // Check for low stock alert
      if (product.stockStatus === 'low_stock') {
        await NotificationService.lowStockAlert(product);
      }
      
      return product;
    } catch (error) {
      console.error('Stock update failed:', error);
      throw error;
    }
  }

  // Bulk stock update
  static async bulkUpdateStock(updates, userId) {
    const results = [];
    const errors = [];
    
    for (const update of updates) {
      try {
        const { productId, quantity, type, reason, notes } = update;
        
        const product = await this.updateStock(
          productId,
          quantity,
          type,
          userId,
          null,
          reason,
          notes
        );
        
        results.push({
          productId,
          success: true,
          newStock: product.stockQuantity,
          productName: product.name
        });
      } catch (error) {
        errors.push({
          productId: update.productId,
          error: error.message
        });
      }
    }
    
    return { results, errors };
  }

  // Get stock history for product
  static async getProductStockHistory(productId, limit = 50) {
    const history = await StockHistory.find({ product: productId })
      .populate('performedBy', 'firstName lastName')
      .sort('-performedAt')
      .limit(limit);
    
    return history;
  }

  // Get low stock products
  static async getLowStockProducts(threshold = null) {
    const query = {
      stockStatus: 'low_stock',
      isActive: true
    };
    
    if (threshold) {
      query.stockQuantity = { $lte: threshold };
    }
    
    const products = await Product.find(query)
      .select('name sku stockQuantity lowStockThreshold sellingPrice images')
      .populate('images')
      .sort('stockQuantity');
    
    return products;
  }

  // Get out of stock products
  static async getOutOfStockProducts() {
    const products = await Product.find({
      stockStatus: 'out_of_stock',
      isActive: true
    })
    .select('name sku stockQuantity sellingPrice images')
    .populate('images')
    .sort('name');
    
    return products;
  }

  // Get stock summary
  static async getStockSummary() {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: '$stockStatus',
          count: { $sum: 1 },
          totalValue: { 
            $sum: { 
              $multiply: ['$stockQuantity', '$sellingPrice'] 
            } 
          },
          totalStock: { $sum: '$stockQuantity' }
        }
      }
    ]);
    
    // Get total products
    const totalProducts = await Product.countDocuments({ isActive: true });
    
    // Get low stock count
    const lowStockCount = await Product.countDocuments({
      stockStatus: 'low_stock',
      isActive: true
    });
    
    // Get total stock value
    const totalStockValue = summary.reduce((total, item) => total + item.totalValue, 0);
    
    return {
      summary,
      totals: {
        totalProducts,
        lowStockCount,
        totalStockValue
      }
    };
  }

  // Check stock availability for products
  static async checkStockAvailability(productQuantities) {
    const unavailable = [];
    
    for (const item of productQuantities) {
      const product = await Product.findById(item.productId);
      
      if (!product || !product.isActive) {
        unavailable.push({
          productId: item.productId,
          reason: 'Product not found or inactive'
        });
      } else if (product.stockQuantity < item.quantity) {
        unavailable.push({
          productId: item.productId,
          productName: product.name,
          requested: item.quantity,
          available: product.stockQuantity,
          reason: 'Insufficient stock'
        });
      }
    }
    
    return {
      available: unavailable.length === 0,
      unavailable
    };
  }

  // Restock recommendation based on sales
  static async getRestockRecommendations(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get products with sales in last X days
    const salesData = await StockHistory.aggregate([
      {
        $match: {
          type: 'stock_out',
          performedAt: { $gte: startDate },
          referenceType: 'order'
        }
      },
      {
        $group: {
          _id: '$product',
          totalSold: { $sum: '$quantity' },
          daysWithSales: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$performedAt' } } }
        }
      },
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
          sku: '$product.sku',
          currentStock: '$product.stockQuantity',
          lowStockThreshold: '$product.lowStockThreshold',
          totalSold: 1,
          averageDailySales: { $divide: ['$totalSold', days] },
          daysWithSalesCount: { $size: '$daysWithSales' },
          salesFrequency: { $divide: [{ $size: '$daysWithSales' }, days] }
        }
      },
      { $sort: { averageDailySales: -1 } }
    ]);
    
    // Calculate restock recommendations
    const recommendations = salesData.map(item => {
      const daysOfStock = item.currentStock / item.averageDailySales;
      const recommendedStock = Math.ceil(item.averageDailySales * 30); // 30 days stock
      const restockQuantity = recommendedStock - item.currentStock;
      
      return {
        ...item,
        daysOfStock,
        recommendedStock,
        restockQuantity: restockQuantity > 0 ? restockQuantity : 0,
        priority: daysOfStock < 7 ? 'High' : daysOfStock < 14 ? 'Medium' : 'Low'
      };
    });
    
    return recommendations.filter(rec => rec.restockQuantity > 0);
  }
}

module.exports = StockService;