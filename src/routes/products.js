const express = require('express');
const {
  getAllProducts,
  getProduct,
  searchProducts,
  getFeaturedProducts,
  getNewArrivals,
  getBestSellers,
  getProductsOnSale,
  getProductsByCategory,
  getSimilarProducts,
  getProductFilters,
  getProductReviews
} = require('../controllers/productController');

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/search', searchProducts);
router.get('/featured', getFeaturedProducts);
router.get('/new-arrivals', getNewArrivals);
router.get('/best-sellers', getBestSellers);
router.get('/on-sale', getProductsOnSale);
router.get('/category/:categorySlug', getProductsByCategory);
router.get('/filters', getProductFilters);
router.get('/:id', getProduct);
router.get('/:id/similar', getSimilarProducts);
router.get('/:id/reviews', getProductReviews);

module.exports = router;