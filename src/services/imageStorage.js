const axios = require('axios');
const cloudinary = require('cloudinary').v2;

/**
 * Image storage, provider-agnostic.
 *
 * Provider precedence: Cloudinary, then ImgBB, then S3.
 *
 * Cloudinary is the default for deployed environments — ImgBB blocks datacenter
 * IP ranges ("You have been forbidden to use this website"), so server-side
 * uploads from Render fail there regardless of the key. ImgBB is kept because
 * it works fine from a developer machine and needs only one variable.
 *
 * S3 never reaches this module: middleware/upload.js streams straight to the
 * bucket when AWS is configured.
 *
 * Every provider returns the same shape so callers (and the admin panel) do not
 * care which one is active:
 *   { url, key, size, contentType }
 */

const IMGBB_ENDPOINT = 'https://api.imgbb.com/1/upload';

const imgbbKey = () => (process.env.IMGBB_API_KEY || '').trim();

const isImgbbConfigured = () => Boolean(imgbbKey());

const isS3Configured = () =>
  Boolean(
    process.env.AWS_S3_BUCKET_NAME &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
  );

// Cloudinary accepts either CLOUDINARY_URL (cloudinary://key:secret@cloud) or
// the three discrete variables.
const isCloudinaryConfigured = () =>
  Boolean(
    (process.env.CLOUDINARY_URL || '').trim() ||
      ((process.env.CLOUDINARY_CLOUD_NAME || '').trim() &&
        (process.env.CLOUDINARY_API_KEY || '').trim() &&
        (process.env.CLOUDINARY_API_SECRET || '').trim())
  );

let cloudinaryReady = false;
const configureCloudinary = () => {
  if (cloudinaryReady) return;
  // The SDK reads CLOUDINARY_URL from the environment on its own; only pass
  // explicit values when the discrete variables are the ones that are set.
  if (!(process.env.CLOUDINARY_URL || '').trim()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  }
  cloudinary.config({ secure: true });
  cloudinaryReady = true;
};

/** Which provider will handle an upload right now. */
const activeProvider = () => {
  if (isCloudinaryConfigured()) return 'cloudinary';
  if (isImgbbConfigured()) return 'imgbb';
  if (isS3Configured()) return 's3';
  return null;
};

/**
 * Send one in-memory file to Cloudinary.
 * @param {{buffer: Buffer, originalname: string, mimetype: string, size: number}} file
 */
async function uploadToCloudinary(file, folder = 'general') {
  configureCloudinary();

  const safeFolder = String(folder).replace(/[^a-zA-Z0-9-_/]/g, '') || 'general';

  // Deliberately uploader.upload(), not uploader.upload_stream().
  //
  // upload_stream hands back the stream and keeps its internal Q deferred to
  // itself (see cloudinary/lib/api_client/execute_request.js — it rejects the
  // deferred AND calls the callback, then returns deferred.promise to a caller
  // that never receives it). With the callback style that rejection has no
  // handler, and server.js exits the process on unhandledRejection — so a
  // single corrupt image took the whole API down.
  //
  // upload() returns that same promise, so awaiting it handles the rejection.
  const dataUri = `data:${file.mimetype || 'image/png'};base64,${file.buffer.toString('base64')}`;

  let result;
  try {
    result = await cloudinary.uploader.upload(dataUri, {
      folder: `feauag/${safeFolder}`,
      resource_type: 'image',
      // Let Cloudinary pick the best format/quality for each viewer
      transformation: [{ quality: 'auto', fetch_format: 'auto' }]
    });
  } catch (err) {
    // The SDK rejects with a plain object, not an Error
    const message =
      err?.message ||
      err?.error?.message ||
      (typeof err === 'string' ? err : 'Cloudinary rejected the upload');
    throw new Error(String(message));
  }

  if (!result?.secure_url) {
    throw new Error('Cloudinary returned no URL');
  }

  return {
    url: result.secure_url,
    key: result.public_id,
    size: result.bytes || file.size,
    contentType: result.format ? `image/${result.format}` : file.mimetype,
    width: result.width,
    height: result.height
  };
}

/**
 * Send one in-memory file to ImgBB.
 * @param {{buffer: Buffer, originalname: string, mimetype: string, size: number}} file
 * @param {string} [folder] prefixed onto the stored name purely for traceability
 */
async function uploadToImgbb(file, folder = 'general') {
  if (!isImgbbConfigured()) {
    throw new Error('IMGBB_API_KEY is not set');
  }

  const safeFolder = String(folder).replace(/[^a-zA-Z0-9-_]/g, '') || 'general';
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-');

  const form = new URLSearchParams();
  form.append('key', imgbbKey());
  // ImgBB accepts raw base64 (no data: prefix)
  form.append('image', file.buffer.toString('base64'));
  form.append('name', `${safeFolder}-${Date.now()}-${safeName}`);

  let data;
  try {
    ({ data } = await axios.post(IMGBB_ENDPOINT, form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      // Base64 inflates by ~33%; allow headroom for the 10MB upload limit
      maxBodyLength: 40 * 1024 * 1024,
      maxContentLength: 40 * 1024 * 1024,
      timeout: 60_000
    }));
  } catch (err) {
    // axios reports only "status code 400"; ImgBB puts the real reason in the
    // response body, so surface that or the caller is left guessing.
    const body = err.response?.data;
    const detail =
      body?.error?.message ||
      body?.status_txt ||
      (typeof body === 'string' ? body.slice(0, 200) : null);
    throw new Error(
      detail
        ? `ImgBB rejected the upload: ${detail}`
        : `ImgBB request failed (${err.response?.status || err.code || 'no response'})`
    );
  }

  if (!data || !data.success || !data.data) {
    throw new Error(data?.error?.message || 'ImgBB rejected the upload');
  }

  const d = data.data;
  return {
    // display_url is the CDN-optimised variant; url is the original
    url: d.display_url || d.url,
    key: d.id,
    size: Number(d.size) || file.size,
    contentType: d.image?.mime || file.mimetype,
    // Keeping this lets an admin delete the image later if you add that feature
    deleteUrl: d.delete_url,
    thumbnailUrl: d.thumb?.url
  };
}

/** Store a single file with whichever provider is configured. */
async function storeImage(file, folder) {
  const provider = activeProvider();

  if (provider === 'cloudinary') {
    return uploadToCloudinary(file, folder);
  }

  if (provider === 'imgbb') {
    return uploadToImgbb(file, folder);
  }

  // multer-s3 has already written the file and populated these fields
  if (file.location) {
    return {
      url: file.location,
      key: file.key,
      size: file.size,
      contentType: file.contentType || file.mimetype
    };
  }

  throw new Error('No image storage provider is configured');
}

/** Store several files, preserving order. */
async function storeImages(files, folder) {
  return Promise.all(files.map((f) => storeImage(f, folder)));
}

module.exports = {
  storeImage,
  storeImages,
  activeProvider,
  isCloudinaryConfigured,
  isImgbbConfigured,
  isS3Configured
};
