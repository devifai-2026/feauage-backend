const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Public projection: never leak admin bookkeeping fields (createdBy, audit
// timestamps) to the storefront. `isActive` is included because existing
// storefront components re-filter on it client-side.
const PUBLIC_FIELDS = 'name slug description image icon displayOrder categoryType parentCategory isActive';

// @desc    Get all active categories
// @route   GET /api/v1/categories
// @access  Public
exports.getAllCategories = catchAsync(async (req, res, next) => {
  const filter = { isActive: true };

  // Storefront listings normally only want top-level categories
  if (req.query.type === 'main') {
    filter.$or = [
      { categoryType: 'main' },
      { categoryType: { $exists: false } }
    ];
  }

  const categories = await Category.find(filter)
    .select(PUBLIC_FIELDS)
    .sort('displayOrder')
    .lean();

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: { categories }
  });
});

// @desc    Get a single active category by slug (falls back to id)
// @route   GET /api/v1/categories/:slug
// @access  Public
exports.getCategoryBySlug = catchAsync(async (req, res, next) => {
  const { slug } = req.params;

  const query = { isActive: true, slug: slug.toLowerCase() };
  const category = await Category.findOne(query).select(PUBLIC_FIELDS).lean()
    // Some storefront links still pass an id rather than a slug
    || (slug.match(/^[0-9a-fA-F]{24}$/)
      ? await Category.findOne({ _id: slug, isActive: true }).select(PUBLIC_FIELDS).lean()
      : null);

  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  const productCount = await Product.countDocuments({
    category: category._id,
    isActive: true
  });

  res.status(200).json({
    status: 'success',
    data: { category: { ...category, productCount } }
  });
});

// @desc    Get active subcategories of a category
// @route   GET /api/v1/categories/:categoryId/subcategories
// @access  Public
exports.getSubcategoriesByCategory = catchAsync(async (req, res, next) => {
  const { categoryId } = req.params;

  let category;
  if (categoryId.match(/^[0-9a-fA-F]{24}$/)) {
    category = await Category.findOne({ _id: categoryId, isActive: true }).lean();
  } else {
    category = await Category.findOne({ slug: categoryId.toLowerCase(), isActive: true }).lean();
  }

  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  const subcategories = await SubCategory.find({
    category: category._id,
    isActive: true
  })
    .select('name slug description image displayOrder category')
    .sort('displayOrder')
    .lean();

  res.status(200).json({
    status: 'success',
    results: subcategories.length,
    data: { subcategories }
  });
});

// @desc    Get all active subcategories
// @route   GET /api/v1/subcategories
// @access  Public
exports.getAllSubcategories = catchAsync(async (req, res, next) => {
  const filter = { isActive: true };

  if (req.query.category) {
    filter.category = req.query.category;
  }

  const subcategories = await SubCategory.find(filter)
    .select('name slug description image displayOrder category')
    .populate('category', 'name slug')
    .sort('displayOrder')
    .lean();

  res.status(200).json({
    status: 'success',
    results: subcategories.length,
    data: { subcategories }
  });
});
