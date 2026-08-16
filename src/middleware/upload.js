const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const path = require('path');
const AppError = require('../utils/appError');

// =============================
// AWS S3 CONFIG
// =============================

// Only pass explicit credentials when they are actually set. Passing empty
// strings makes the SDK fall through to the machine's ambient AWS profile,
// which silently uploads to whatever account happens to be configured.
const hasExplicitCreds = Boolean(
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
);

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(hasExplicitCreds
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

// ImgBB needs only an API key; S3 needs a bucket AND credentials. Either is
// enough. Without one, the AWS SDK throws a low-level error
// (PermanentRedirect / CredentialsProviderError) that reaches the admin as an
// unreadable stack trace, making the panel look broken.
const useImgbb = () => Boolean((process.env.IMGBB_API_KEY || '').trim());

const useCloudinary = () =>
  Boolean(
    (process.env.CLOUDINARY_URL || '').trim() ||
      ((process.env.CLOUDINARY_CLOUD_NAME || '').trim() &&
        (process.env.CLOUDINARY_API_KEY || '').trim() &&
        (process.env.CLOUDINARY_API_SECRET || '').trim())
  );

// Anything that is not S3 needs the bytes in memory so the service can forward
// them; only multer-s3 streams straight to its destination.
const useMemoryStorage = () => useCloudinary() || useImgbb();

const isStorageConfigured = () =>
  useCloudinary() || useImgbb() || (Boolean(process.env.AWS_S3_BUCKET_NAME) && hasExplicitCreds);

const requireStorageConfigured = (req, res, next) => {
  if (!isStorageConfigured()) {
    return next(
      new AppError(
        'Image uploads are not configured on this server. Set CLOUDINARY_URL ' +
          '(recommended), or IMGBB_API_KEY, or AWS_S3_BUCKET_NAME + ' +
          'AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, then restart.',
        503
      )
    );
  }
  next();
};

// =============================
// FILE FILTER
// =============================

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const ext = path.extname(file.originalname).toLowerCase();
  const extname = filetypes.test(ext);
  const mimetype = filetypes.test(file.mimetype);

  // Some clients send application/octet-stream for formats their MIME table
  // does not know (commonly .webp). Rejecting a valid photo on that basis is a
  // poor experience, and the extension check plus the storage provider's own
  // validation still apply, so accept an unknown type with a valid extension.
  const unknownType =
    !file.mimetype ||
    file.mimetype === 'application/octet-stream' ||
    file.mimetype === 'binary/octet-stream';

  if (extname && (mimetype || unknownType)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Only image files are allowed (jpg, jpeg, png, gif, webp). Received "${file.originalname}" as ${file.mimetype || 'unknown type'}.`,
        400
      ),
      false
    );
  }
};

// =============================
// COMMON STORAGE FACTORY
// =============================

// With ImgBB we need the bytes in hand to POST them on, so keep the file in
// memory rather than streaming it to a bucket.
const createStorage = (folder) =>
  useMemoryStorage()
    ? multer.memoryStorage()
    : multerS3({
    s3,
    // multer-s3 throws "bucket is required" at module-load time when this is
    // undefined, which takes the whole server down on boot. Fall back to a
    // placeholder; requireStorageConfigured rejects the request long before
    // any upload is actually attempted against it.
    bucket: process.env.AWS_S3_BUCKET_NAME || 'unconfigured-bucket',
    contentType: multerS3.AUTO_CONTENT_TYPE,

    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },

    key: (req, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const timestamp = Date.now();

      const sanitizedName = file.originalname.replace(
        /[^a-zA-Z0-9.-]/g,
        '-'
      );

      cb(null, `${folder}/${userId}-${timestamp}-${sanitizedName}`);
    },
  });

// =============================
// MULTER FACTORY
// =============================

const createUploader = (folder, sizeMB = 5) =>
  multer({
    storage: createStorage(folder),
    limits: { fileSize: sizeMB * 1024 * 1024 },
    fileFilter,
  });

// =============================
// EXPORTS
// =============================

module.exports = {
  isStorageConfigured,
  requireStorageConfigured,

  // Products (max 10 images)
  uploadProductImages: createUploader('products', 5).array(
    'images',
    10
  ),

  // Banner (single)
  uploadBannerImage: createUploader('banners', 5).single(
    'image'
  ),

  // Profile (single, smaller limit)
  uploadProfileImage: createUploader('users', 2).single(
    'image'
  ),

  // Reviews (max 5)
  uploadReviewImages: createUploader('reviews', 3).array(
    'images',
    5
  ),

  // Category
  uploadCategoryImage: createUploader('categories', 2).single(
    'image'
  ),

  // Generic Single
  uploadSingle: (fieldName) =>
    createUploader(fieldName, 5).single(fieldName),

  // Generic via ?folder=xyz
  uploadGenericSingle: multer({
    storage: useMemoryStorage() ? multer.memoryStorage() : multerS3({
      s3,
      bucket: process.env.AWS_S3_BUCKET_NAME || 'unconfigured-bucket',
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const folder = (
          req.query.folder ||
          req.body.folder ||
          'general'
        ).replace(/[^a-zA-Z0-9-_]/g, '');

        const timestamp = Date.now();
        const sanitizedName = file.originalname.replace(
          /[^a-zA-Z0-9.-]/g,
          '-'
        );

        cb(null, `${folder}/${timestamp}-${sanitizedName}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter,
  }).single('image'),

  uploadGenericMultiple: multer({
    storage: useMemoryStorage() ? multer.memoryStorage() : multerS3({
      s3,
      bucket: process.env.AWS_S3_BUCKET_NAME || 'unconfigured-bucket',
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const folder = (
          req.query.folder ||
          req.body.folder ||
          'general'
        ).replace(/[^a-zA-Z0-9-_]/g, '');

        const timestamp = Date.now();
        const sanitizedName = file.originalname.replace(
          /[^a-zA-Z0-9.-]/g,
          '-'
        );

        cb(null, `${folder}/${timestamp}-${sanitizedName}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter,
  }).array('images', 10),

  // Fully Custom Multiple
  uploadMultiple: (fieldName, maxCount) =>
    createUploader(fieldName, 5).array(fieldName, maxCount),
};
