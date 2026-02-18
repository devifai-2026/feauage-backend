
const { S3Client } = require('@aws-sdk/client-s3');

console.log('S3Client type:', typeof S3Client);

try {
    const s3 = new S3Client({
        region: 'us-east-1',
        credentials: {
            accessKeyId: 'test',
            secretAccessKey: 'test',
        },
    });

    console.log('s3 instance created');
    console.log('s3.send type:', typeof s3.send);
} catch (error) {
    console.error('Error creating S3Client:', error);
}
