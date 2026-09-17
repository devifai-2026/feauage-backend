/**
 * Seeds the About page's top and bottom banner slots.
 *
 * The About page already reads these from the Banner collection
 * (page: "about", position: "top" | "bottom"); they were simply never
 * created, so the page fell back to the placeholder image.
 *
 * Safe to re-run: existing banners are left alone unless --force is passed.
 *
 * Usage:
 *   node src/seeds/seedAboutBanners.js
 *   node src/seeds/seedAboutBanners.js --force
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Banner = require('../models/Banner');
const User = require('../models/User');

// Distinct image per slot — the top hero and the closing shot are different photos.
const TOP_IMAGE_URL =
  'https://cdn.prod.website-files.com/66d5c8a0f16078270af4fa77/66d5c8b86d7edcc8641dfa8e_Image-41-p-2000.jpg';
const BOTTOM_IMAGE_URL =
  'https://cdn.prod.website-files.com/66d5c8a0f16078270af4fa77/66d5c8bb7dc83b58bb213479_Image-43-p-2000.jpg';

const SLOTS = [
  {
    name: 'about-top',
    title: 'About Us',
    page: 'about',
    position: 'top',
    bannerType: 'header',
    image: TOP_IMAGE_URL,
    alt: 'Craftsmanship at Feauag'
  },
  {
    name: 'about-bottom',
    title: 'Our Craft',
    page: 'about',
    position: 'bottom',
    bannerType: 'header',
    image: BOTTOM_IMAGE_URL,
    alt: 'Feauag jewellery craftsmanship'
  }
];

(async () => {
  const force = process.argv.includes('--force');

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set — run this from feauage-backend/ so .env is picked up.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    // Banner.createdBy is required — attribute seeded banners to an admin.
    const admin = await User.findOne({ role: { $in: ['admin', 'superadmin'] } }).select('_id email');
    if (!admin) {
      console.error('No admin user found — seed an admin first.');
      process.exit(1);
    }
    console.log(`Attributing banners to ${admin.email}`);

    for (const slot of SLOTS) {
      const existing = await Banner.findOne({ page: slot.page, position: slot.position });

      if (existing && !force) {
        console.log(`⏭️  ${slot.page}/${slot.position} already exists ("${existing.name}") — skipped. Use --force to overwrite.`);
        continue;
      }

      const doc = {
        name: slot.name,
        title: slot.title,
        page: slot.page,
        position: slot.position,
        bannerType: slot.bannerType,
        isActive: true,
        displayOrder: 0,
        createdBy: admin._id,
        images: [{ url: slot.image, alt: slot.alt, isPrimary: true, displayOrder: 0 }]
      };

      if (existing) {
        Object.assign(existing, doc);
        await existing.save();
        console.log(`♻️  ${slot.page}/${slot.position} overwritten`);
      } else {
        await Banner.create(doc);
        console.log(`✅ ${slot.page}/${slot.position} created`);
      }
    }

    console.log('\n--- verification ---');
    const all = await Banner.find({ page: 'about' }).sort('position');
    all.forEach((b) => {
      console.log(`  ${b.position.padEnd(7)} active=${b.isActive} images=${b.images.length} url=${b.images[0]?.url?.slice(0, 60)}...`);
    });

    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
