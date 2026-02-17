
require('dotenv').config();
const uploadMiddleware = require('./src/middleware/upload');

// Helper to check if an object is an S3Client
const isS3Client = (client) => {
    return client && typeof client.send === 'function';
};

console.log('Checking uploadMiddleware export...');

// Access one of the upload middlewares, e.g., uploadProductImages
// It is an array of middlewares because .array() returns middleware
// But in upload.js: uploadProductImages: productUpload.array('images', 10)
// This returns a function (middleware)

// We can't easily inspect the internal `multer` instance from the middleware function directly
// without diving into multer's internals or mocking require.

// Instead, let's verify if we can instantiate s3 and multer-s3 directly here without error
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');
const multer = require('multer');

console.log('Testing manual configuration...');

try {
    const s3 = new S3Client({
        region: 'ap-south-1',
        credentials: {
            accessKeyId: 'test',
            secretAccessKey: 'test',
        }
    });

    console.log('S3 Client created. Hash check send:', typeof s3.send);

    const storage = multerS3({
        s3: s3,
        bucket: 'test-bucket',
        acl: 'public-read'
    });

    console.log('Storage engine created.');

    // multer-s3 v3 stores the s3 client in 'this.client' (bound in constructor?)
    // Let's see if we can trigger the error by mocking a file upload
    // Or just inspecting the storage object.
    // storage.s3 should be our client? No, looking at source it sets this.client = options.s3

    console.log('S3 client in storage:', typeof storage.s3); // might be undefined if not exposed

    // If this script runs without "this.client.send is not a function", then basic setup is correct.
    console.log('Setup seems OK.');

} catch (err) {
    console.error('CRASH:', err);
}
