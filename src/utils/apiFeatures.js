// utils/apiFeatures.js
class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
    this.filterQuery = {};
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach(el => delete queryObj[el]);

    // 1) Advanced cleaning and nested object expansion (handles field[op]=val)
    const expandedQuery = {};
    Object.keys(queryObj).forEach(key => {
      const val = queryObj[key];
      if (val === '' || val === null || val === undefined) return;

      // Handle bracketed notation: field[op]=val
      const match = key.match(/^(.+)\[(.+)\]$/);
      if (match) {
        const [, field, op] = match;
        if (!expandedQuery[field]) expandedQuery[field] = {};
        
        // Convert operator (gte -> $gte)
        const mongoOp = ['gte', 'gt', 'lte', 'lt', 'in', 'ne'].includes(op) ? `$${op}` : op;
        expandedQuery[field][mongoOp] = val;
      } else if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
        // Handle stringified arrays: field=['a','b']
        try {
          const jsonVal = val.replace(/'/g, '"');
          const parsedArray = JSON.parse(jsonVal);
          if (Array.isArray(parsedArray) && parsedArray.length > 0) {
            expandedQuery[key] = { $in: parsedArray };
          }
        } catch (e) {
          expandedQuery[key] = val;
        }
      } else {
        expandedQuery[key] = val;
      }
    });

    // 2) Replace standard gte|gt|lte|lt in any remaining nested objects (only if not already prefixed)
    // This handles both req.query.sellingPrice.gte AND req.query['sellingPrice[gte]']
    let queryStr = JSON.stringify(expandedQuery);
    queryStr = queryStr.replace(/\b(?<!\$)(gte|gt|lte|lt|in|ne)\b/g, match => `$${match}`);
    
    const parsedQuery = JSON.parse(queryStr);

    // 3) Final pass: Convert strings to numbers for comparison operators
    const finalizeQuery = (obj) => {
      Object.keys(obj).forEach(key => {
        const val = obj[key];
        if (typeof val === 'object' && val !== null) {
          finalizeQuery(val);
        } else if (typeof val === 'string' && !isNaN(val) && val.trim() !== '') {
          // If the key is a comparison operator, convert to number
          if (['$gte', '$gt', '$lte', '$lt'].includes(key)) {
            obj[key] = Number(val);
          }
        }
      });
    };

    finalizeQuery(parsedQuery);
    this.filterQuery = parsedQuery;

    console.log("Final filter query:", this.filterQuery);
    this.query = this.query.find(this.filterQuery);

    return this;
  }

  search() {
    if (this.queryString.search) {
      const searchTerm = this.queryString.search;
      const searchQuery = {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { sku: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { brand: { $regex: searchTerm, $options: 'i' } },
          { tags: { $regex: searchTerm, $options: 'i' } }
        ]
      };

      this.filterQuery = { ...this.filterQuery, ...searchQuery };
      this.query = this.query.find(searchQuery);
    }
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 10; // Changed default to 10
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;