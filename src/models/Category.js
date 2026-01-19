const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  // Parent category reference for subcategories only
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
    // Add validation: only subcategories should have parentCategory
    validate: {
      validator: function(value) {
        // If this is a main category, parentCategory must be null
        // If this is a subcategory, parentCategory must be a valid ObjectId
        const isSubcategory = this.categoryType === 'subcategory';
        return isSubcategory ? !!value : !value;
      },
      message: 'Main categories cannot have parent categories'
    }
  },
  // Add category type field to distinguish between main and subcategory
  categoryType: {
    type: String,
    enum: {
      values: ['main', 'subcategory'],
      message: 'Category type must be either "main" or "subcategory"'
    },
    default: 'main'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  image: {
    type: String,
    default: 'default-category.jpg'
  },
  displayOrder: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metaTitle: String,
  metaDescription: String,
  metaKeywords: [String],
  productCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ displayOrder: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ name: 'text', description: 'text' });
categorySchema.index({ createdBy: 1 });
categorySchema.index({ categoryType: 1 }); // Index for category type

// Virtual for subcategories (only for main categories)
categorySchema.virtual('subcategories', {
  ref: 'Category',
  foreignField: 'parentCategory',
  localField: '_id',
  match: { 
    isActive: true,
    categoryType: 'subcategory'
  }
});

// Virtual for products
categorySchema.virtual('products', {
  ref: 'Product',
  foreignField: 'category',
  localField: '_id',
  match: { isActive: true }
});

// Virtual for parent category (for subcategories)
categorySchema.virtual('parent', {
  ref: 'Category',
  localField: 'parentCategory',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware to generate slug
categorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      trim: true
    });
  }
  next();
});

// Pre-save middleware to validate category type logic
categorySchema.pre('save', function(next) {
  // If categoryType is 'main', ensure parentCategory is null
  if (this.categoryType === 'main' && this.parentCategory) {
    this.parentCategory = null;
  }
  
  // If categoryType is 'subcategory', ensure parentCategory exists
  if (this.categoryType === 'subcategory' && !this.parentCategory) {
    const error = new Error('Subcategories must have a parent category');
    return next(error);
  }
  
  next();
});

// Static method to get main categories (categories without parent)
categorySchema.statics.getMainCategories = function() {
  return this.find({ 
    categoryType: 'main',
    isActive: true 
  })
  .sort('displayOrder')
  .populate('subcategories')
  .lean();
};

// Static method to get subcategories by parent category ID
categorySchema.statics.getSubcategoriesByParentId = function(parentId) {
  return this.find({
    parentCategory: parentId,
    categoryType: 'subcategory',
    isActive: true
  })
  .sort('displayOrder')
  .lean();
};

// Instance method to check if category is main category
categorySchema.methods.isMainCategory = function() {
  return this.categoryType === 'main';
};

// Instance method to check if category is subcategory
categorySchema.methods.isSubcategory = function() {
  return this.categoryType === 'subcategory';
};

// Query helper to filter by category type
categorySchema.query.byType = function(type) {
  return this.where({ categoryType: type });
};

// Query helper to get only main categories
categorySchema.query.mainOnly = function() {
  return this.where({ categoryType: 'main', parentCategory: null });
};

// Query helper to get only subcategories
categorySchema.query.subcategoriesOnly = function() {
  return this.where({ categoryType: 'subcategory' }).ne('parentCategory', null);
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;