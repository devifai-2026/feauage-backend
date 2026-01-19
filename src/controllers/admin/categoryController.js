const Category = require('../../models/Category');
const SubCategory = require('../../models/SubCategory');
const Product = require('../../models/Product');
const AdminActivity = require('../../models/AdminActivity');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');
const mongoose = require("mongoose")

// @desc    Get all categories (admin view)
// @route   GET /api/v1/admin/categories
// @access  Private/Admin
exports.getAllCategories = catchAsync(async (req, res, next) => {
  const categories = await Category.find()
    .populate('parentCategory', 'name')
    .populate('createdBy', 'firstName lastName')
    .sort('displayOrder');
  
  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: {
      categories
    }
  });
});

// @desc    Get category tree
// @route   GET /api/v1/admin/categories/tree
// @access  Private/Admin
exports.getCategoryTree = catchAsync(async (req, res, next) => {
  // Get all active categories (main categories)
  const categories = await Category.find({ 
    isActive: true 
  })
  .sort('displayOrder')
  .lean();
  
  // Get all active subcategories from SubCategory model
  const SubCategory = mongoose.model('SubCategory');
  const allSubcategories = await SubCategory.find({ 
    isActive: true 
  })
  .sort('displayOrder')
  .lean();
  
  // Build tree structure
  const categoryTree = categories.map(category => {
    // Filter subcategories that belong to this category
    const subcategories = allSubcategories.filter(
      sub => sub.category && 
             sub.category.toString() === category._id.toString()
    );
    
    return {
      ...category,
      children: subcategories.map(sub => ({
        ...sub,
        children: [] // Subcategories don't have further children
      }))
    };
  });
  
  res.status(200).json({
    status: 'success',
    results: categoryTree.length,
    data: {
      categories: categoryTree
    }
  });
});

// @desc    Create category (admin)
// @route   POST /api/v1/admin/categories
// @access  Private/Admin
exports.createCategory = catchAsync(async (req, res, next) => {
  // Extract and validate data
  const {
    name,
    description,
    displayOrder,
    isActive,
    metaTitle,
    metaDescription,
    metaKeywords,
    image, // This could be a URL string
    parentCategory,
    categoryType = 'main' // Default to main category
  } = req.body;
  
  // Validate required fields
  if (!name) {
    return next(new AppError('Category name is required', 400));
  }
  
  // Check if parent category exists and validate category type logic
  if (parentCategory) {
    const parentCategoryDoc = await Category.findById(parentCategory);
    if (!parentCategoryDoc) {
      return next(new AppError('Parent category not found', 404));
    }
    
    // If parent category is provided, categoryType should be 'subcategory'
    req.body.categoryType = 'subcategory';
    
    // Ensure parent category is a main category (not a subcategory)
    if (parentCategoryDoc.categoryType === 'subcategory') {
      return next(new AppError('Cannot create subcategory under another subcategory', 400));
    }
  }
  
  // If no parent category, ensure it's a main category
  if (!parentCategory && categoryType === 'subcategory') {
    return next(new AppError('Subcategories must have a parent category', 400));
  }
  
  // Parse metaKeywords if it's a JSON string
  let parsedMetaKeywords = [];
  if (metaKeywords) {
    try {
      if (typeof metaKeywords === 'string') {
        parsedMetaKeywords = JSON.parse(metaKeywords);
      } else if (Array.isArray(metaKeywords)) {
        parsedMetaKeywords = metaKeywords;
      }
    } catch (error) {
      return next(new AppError('Invalid metaKeywords format. Expected JSON array', 400));
    }
  }
  
  // Handle image upload if file was uploaded
  let imageUrl = image || 'default-category.jpg';
  if (req.file) {
    // If file was uploaded via multer or similar middleware
    imageUrl = `/uploads/categories/${req.file.filename}`;
  }
  
  // Prepare category data
  const categoryData = {
    name,
    description: description || '',
    displayOrder: parseInt(displayOrder) || 0,
    isActive: isActive === 'true' || isActive === true,
    metaTitle: metaTitle || '',
    metaDescription: metaDescription || '',
    metaKeywords: parsedMetaKeywords,
    image: imageUrl,
    parentCategory: parentCategory || null,
    categoryType: parentCategory ? 'subcategory' : (categoryType || 'main'),
    createdBy: req.user.id
  };
  
  // Check for duplicate category name
  const existingCategory = await Category.findOne({ name });
  if (existingCategory) {
    return next(new AppError('Category name already exists', 400));
  }
  
  // Create category
  const category = await Category.create(categoryData);
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'create',
    entityType: 'Category',
    entityId: category._id,
    newState: category.toObject(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      category
    }
  });
});

// @desc    Update category (admin)
// @route   PATCH /api/v1/admin/categories/:id
// @access  Private/Admin
exports.updateCategory = catchAsync(async (req, res, next) => {
  // Get previous state
  const previousCategory = await Category.findById(req.params.id);
  if (!previousCategory) {
    return next(new AppError('Category not found', 404));
  }
  
  // Check if parent category exists if being updated
  if (req.body.parentCategory) {
    const parentCategory = await Category.findById(req.body.parentCategory);
    if (!parentCategory) {
      return next(new AppError('Parent category not found', 404));
    }
    
    // Prevent circular reference
    if (req.body.parentCategory === req.params.id) {
      return next(new AppError('Category cannot be its own parent', 400));
    }
  }
  
  // Update category
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  // Log admin activity
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'update',
    entityType: 'Category',
    entityId: category._id,
    previousState: previousCategory.toObject(),
    newState: category.toObject(),
    changes: req.body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      category
    }
  });
});

// @desc    Delete category (admin)
// @route   DELETE /api/v1/admin/categories/:id
// @access  Private/Admin
exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  // Check if category has products
  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    return next(new AppError('Cannot delete category with products', 400));
  }
  
  // Check if category has subcategories
  const subCategoryCount = await Category.countDocuments({ parentCategory: category._id });
  if (subCategoryCount > 0) {
    return next(new AppError('Cannot delete category with subcategories', 400));
  }
  
  // Log admin activity BEFORE deleting
  await AdminActivity.logActivity({
    adminUser: req.user.id,
    action: 'delete',
    entityType: 'Category',
    entityId: category._id,
    previousState: category.toObject(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Use deleteOne() instead of remove()
  await Category.deleteOne({ _id: category._id });
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Get subcategories
// @route   GET /api/v1/admin/subcategories
// @access  Private/Admin
exports.getSubCategories = catchAsync(async (req, res, next) => {
  const { category, search, isActive, sort } = req.query;
  
  // Build query object
  const query = {};
  
  // Filter by category if provided
  if (category) {
    // Validate if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return next(new AppError('Category not found', 404));
    }
    query.category = category;
  }
  
  // Filter by active status
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }
  
  // Search by name or description
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Build sort
  let sortBy = 'displayOrder name';
  if (sort) {
    sortBy = sort.split(',').join(' ');
  }
  
  // Execute query with pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const skip = (page - 1) * limit;
  
  const subCategories = await SubCategory.find(query)
    .populate('category', 'name slug isActive')
    .sort(sortBy)
    .skip(skip)
    .limit(limit);
  
  // Get total count for pagination
  const total = await SubCategory.countDocuments(query);
  
  // Add product count to each subcategory
  const subCategoriesWithCount = await Promise.all(
    subCategories.map(async (subCategory) => {
      const productCount = await Product.countDocuments({ 
        subCategory: subCategory._id 
      });
      
      return {
        ...subCategory.toObject(),
        productCount
      };
    })
  );
  
  res.status(200).json({
    status: 'success',
    results: subCategoriesWithCount.length,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: {
      subCategories: subCategoriesWithCount
    }
  });
});

// @desc    Get single subcategory
// @route   GET /api/v1/admin/subcategories/:id
// @access  Private/Admin
exports.getSubCategory = catchAsync(async (req, res, next) => {
  const subCategory = await SubCategory.findById(req.params.id)
    .populate('category', 'name slug description');
  
  if (!subCategory) {
    return next(new AppError('Subcategory not found', 404));
  }
  
  // Get product count
  const productCount = await Product.countDocuments({ 
    subCategory: subCategory._id 
  });
  
  const subCategoryWithCount = {
    ...subCategory.toObject(),
    productCount
  };
  
  res.status(200).json({
    status: 'success',
    data: {
      subCategory: subCategoryWithCount
    }
  });
});

// @desc    Create subcategory (admin)
// @route   POST /api/v1/admin/subcategories
// @access  Private/Admin
exports.createSubCategory = catchAsync(async (req, res, next) => {
  // Check if category exists
  const category = await Category.findById(req.body.category);
  if (!category) {
    return next(new AppError('Category not found', 404));
  }
  
  const subCategory = await SubCategory.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: {
      subCategory
    }
  });
});

// @desc    Update subcategory (admin)
// @route   PATCH /api/v1/admin/subcategories/:id
// @access  Private/Admin
exports.updateSubCategory = catchAsync(async (req, res, next) => {
  const subCategory = await SubCategory.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!subCategory) {
    return next(new AppError('Subcategory not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      subCategory
    }
  });
});

// @desc    Delete subcategory (admin)
// @route   DELETE /api/v1/admin/subcategories/:id
// @access  Private/Admin
exports.deleteSubCategory = catchAsync(async (req, res, next) => {
  const subCategory = await SubCategory.findById(req.params.id);
  
  if (!subCategory) {
    return next(new AppError('Subcategory not found', 404));
  }
  
  // Check if subcategory has products
  const productCount = await Product.countDocuments({ subCategory: subCategory._id });
  if (productCount > 0) {
    return next(new AppError('Cannot delete subcategory with products', 400));
  }
  
  await subCategory.remove();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});