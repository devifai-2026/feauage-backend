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

    // Remove empty strings, null, and undefined values from queryObj
    Object.keys(queryObj).forEach(key => {
      if (queryObj[key] === '' || queryObj[key] === null || queryObj[key] === undefined) {
        delete queryObj[key];
      }
      
      // Also handle date range fields
      if (key === 'startDate' || key === 'endDate') {
        delete queryObj[key];
      }
    });

    // If startDate and endDate are provided separately, create a date range filter
    if (this.queryString.startDate || this.queryString.endDate) {
      const dateFilter = {};
      
      if (this.queryString.startDate) {
        dateFilter.$gte = new Date(this.queryString.startDate);
      }
      
      if (this.queryString.endDate) {
        dateFilter.$lte = new Date(this.queryString.endDate);
      }
      
      if (Object.keys(dateFilter).length > 0) {
        queryObj.createdAt = dateFilter;
      }
    }

    // Advanced filtering for gte, gt, lte, lt operators
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    if (queryStr === '{}') {
      this.filterQuery = {};
    } else {
      this.filterQuery = JSON.parse(queryStr);
    }
    
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
          { description: { $regex: searchTerm, $options: 'i' } }
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