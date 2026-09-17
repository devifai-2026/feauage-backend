/**
 * Seeds the homepage services strip and FAQ accordion into the Settings
 * singleton, using the copy that was previously hardcoded in the storefront.
 *
 * Safe to re-run: existing non-empty values are left alone unless --force is
 * passed, so this will not clobber edits an admin has already made.
 *
 * Usage:
 *   node src/seeds/seedHomeSections.js
 *   node src/seeds/seedHomeSections.js --force
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('../models/Settings');

const SERVICE_HIGHLIGHTS = [
  { icon: 'diamond', title: 'Quality Certified', subtitle: 'Available certificates of Authenticity', enabled: true, displayOrder: 1 },
  { icon: 'lock', title: 'Secure Transaction', subtitle: 'Certified Marketplace still 2017', enabled: true, displayOrder: 2 },
  { icon: 'truck', title: 'Free Shipping', subtitle: 'Free, Fast And Reliable Worldwide', enabled: true, displayOrder: 3 },
  { icon: 'people', title: 'Transparent Services', subtitle: 'Satisfying hassle-free return policy', enabled: true, displayOrder: 4 }
];

const FAQS = [
  {
    question: 'Are your products certified and of high quality?',
    answer: 'Yes, all of our products are crafted with the highest quality materials and undergo thorough quality checks. We also provide certificates of authenticity for our diamond and gemstone jewelry.',
    enabled: true,
    displayOrder: 1
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept various payment methods including credit cards (Visa, MasterCard, American Express), PayPal, bank transfers, and installment payment options through our financing partners.',
    enabled: true,
    displayOrder: 2
  },
  {
    question: 'Do you offer customization options for jewelry?',
    answer: 'Yes, we offer comprehensive customization services. You can customize ring settings, engrave special messages, choose different gemstones, and work with our designers to create unique pieces that match your style and preferences.',
    enabled: true,
    displayOrder: 3
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

    const settings = await Settings.getSettings();

    const hasServices = Array.isArray(settings.serviceHighlights) && settings.serviceHighlights.length > 0;
    const hasFaqs = Array.isArray(settings.faqs) && settings.faqs.length > 0;

    if (!hasServices || force) {
      settings.serviceHighlights = SERVICE_HIGHLIGHTS;
      settings.serviceHighlightsEnabled = true;
      console.log(`✅ serviceHighlights seeded (${SERVICE_HIGHLIGHTS.length} items)${force && hasServices ? ' [overwritten]' : ''}`);
    } else {
      console.log(`⏭️  serviceHighlights already present (${settings.serviceHighlights.length}) — skipped. Use --force to overwrite.`);
    }

    if (!hasFaqs || force) {
      settings.faqs = FAQS;
      settings.faqTitle = settings.faqTitle || 'FAQ';
      settings.faqsEnabled = true;
      console.log(`✅ faqs seeded (${FAQS.length} items)${force && hasFaqs ? ' [overwritten]' : ''}`);
    } else {
      console.log(`⏭️  faqs already present (${settings.faqs.length}) — skipped. Use --force to overwrite.`);
    }

    await settings.save();

    const saved = await Settings.getSettings();
    console.log('\n--- verification ---');
    console.log('services:', saved.serviceHighlights.map((s) => s.title).join(', '));
    console.log('faqs    :', saved.faqs.length, 'question(s)');
    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
