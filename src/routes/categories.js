const express = require('express');
const {
  getAllCategories,
  getCategoryBySlug,
  getSubcategoriesByCategory
} = require('../controllers/categoryController');

const router = express.Router();

// All public — the storefront reads categories without authenticating
router.get('/', getAllCategories);
router.get('/:categoryId/subcategories', getSubcategoriesByCategory);
router.get('/:slug', getCategoryBySlug);

module.exports = router;
