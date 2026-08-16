// controllers/admin/s3Controller.js
// Upload endpoints. The storage provider (ImgBB or S3) is chosen by
// services/imageStorage based on which environment variables are set; the
// response shape is identical either way so the admin panel is unaffected.
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const { storeImage, storeImages, activeProvider } = require('../../services/imageStorage');

const folderFrom = (req) =>
  String(req.query.folder || req.body.folder || 'general').replace(/[^a-zA-Z0-9-_]/g, '') || 'general';

// @desc    Upload a single image
// @route   POST /api/v1/admin/upload?folder=banners
// @access  Private/Admin
exports.uploadImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload an image file', 400));
  }

  try {
    const stored = await storeImage(req.file, folderFrom(req));
    res.status(200).json({ status: 'success', data: stored });
  } catch (err) {
    console.error(`[upload] ${activeProvider() || 'no provider'} failed:`, err.message);
    return next(new AppError(`Image upload failed: ${err.message}`, 502));
  }
});

// @desc    Upload multiple images
// @route   POST /api/v1/admin/upload-multiple?folder=products
// @access  Private/Admin
exports.uploadImages = catchAsync(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(new AppError('Please upload at least one image file', 400));
  }

  try {
    const files = await storeImages(req.files, folderFrom(req));
    res.status(200).json({
      status: 'success',
      results: files.length,
      data: { files }
    });
  } catch (err) {
    console.error(`[upload] ${activeProvider() || 'no provider'} failed:`, err.message);
    return next(new AppError(`Image upload failed: ${err.message}`, 502));
  }
});
