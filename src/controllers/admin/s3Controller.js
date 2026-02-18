// controllers/s3Controller.js
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

// @desc    Upload single image to S3
// @route   POST /api/v1/admin/upload?folder=banners
// @access  Private/Admin
exports.uploadImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload an image file', 400));
  }

  res.status(200).json({
    status: 'success',
    data: {
      url: req.file.location,
      key: req.file.key,
      size: req.file.size,
      contentType: req.file.contentType || req.file.mimetype
    }
  });
});

// @desc    Upload multiple images to S3
// @route   POST /api/v1/admin/upload-multiple?folder=products
// @access  Private/Admin
exports.uploadImages = catchAsync(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(new AppError('Please upload at least one image file', 400));
  }

  const uploadedFiles = req.files.map(file => ({
    url: file.location,
    key: file.key,
    size: file.size,
    contentType: file.contentType || file.mimetype
  }));

  res.status(200).json({
    status: 'success',
    results: uploadedFiles.length,
    data: {
      files: uploadedFiles
    }
  });
});
