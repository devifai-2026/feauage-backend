// controllers/s3Controller.js
const AWS = require('aws-sdk');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

exports.generatePresignedUrl = catchAsync(async (req, res, next) => {
  const { fileName, fileType } = req.body;

  if (!fileName || !fileType) {
    return next(new AppError('File name and type are required', 400));
  }

  // Sanitize filename
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '-');
  const key = `categories/${Date.now()}-${sanitizedFileName}`;

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    ContentType: fileType,
    Expires: 300 // URL expires in 5 minutes
  };

  const presignedUrl = await s3.getSignedUrlPromise('putObject', params);

  res.status(200).json({
    status: 'success',
    data: {
      presignedUrl,
      fileUrl: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
    }
  });
});