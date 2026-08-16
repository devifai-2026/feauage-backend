const axios = require('axios');

/**
 * Image storage, provider-agnostic.
 *
 * ImgBB is used when IMGBB_API_KEY is set; it needs no bucket, no IAM user and
 * no per-request signing, so uploads work with a single environment variable.
 * S3 remains supported for when AWS is configured — see middleware/upload.js,
 * which streams straight to the bucket in that case and never reaches here.
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

/** Which provider will handle an upload right now. */
const activeProvider = () => {
  if (isImgbbConfigured()) return 'imgbb';
  if (isS3Configured()) return 's3';
  return null;
};

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
  isImgbbConfigured,
  isS3Configured
};
