const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

// Load models
const User = require('../models/User');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const ProductGemstone = require('../models/ProductGemstone');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const Coupon = require('../models/Coupon');
const Banner = require('../models/Banner');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Helper function to generate slugs
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Connect to DB with better timeout settings
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000, // 45 seconds
});

const seedDatabase = async () => {
  try {
    console.log('🌱 Seeding database...');
    
    // Clear existing data with better error handling
    try {
      await User.deleteMany({});
      console.log('✅ Users cleared');
    } catch (error) {
      console.log('⚠️  Could not clear users:', error.message);
    }
    
    try {
      await Category.deleteMany({});
      console.log('✅ Categories cleared');
    } catch (error) {
      console.log('⚠️  Could not clear categories:', error.message);
    }
    
    try {
      await SubCategory.deleteMany({});
      console.log('✅ Subcategories cleared');
    } catch (error) {
      console.log('⚠️  Could not clear subcategories:', error.message);
    }
    
    try {
      await Product.deleteMany({});
      console.log('✅ Products cleared');
    } catch (error) {
      console.log('⚠️  Could not clear products:', error.message);
    }
    
    await ProductImage.deleteMany({});
    await ProductGemstone.deleteMany({});
    await Cart.deleteMany({});
    await Wishlist.deleteMany({});
    await Coupon.deleteMany({});
    await Banner.deleteMany({});
    
    console.log('🗑️  Existing data cleared');
    
    // 1. Create Admin User
    // NOTE: pass the plaintext password — User's pre('save') hook hashes it.
    // Hashing here as well would double-hash and make login impossible.
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const admin = await User.create({
      email: process.env.ADMIN_EMAIL || 'admin@jewellery.com',
      password: adminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '9999999999',
      role: 'superadmin',
      isEmailVerified: true,
      isActive: true,
      gender: 'male'
    });
    console.log('✅ Admin user created');
    
    // 2. Create Sample Customer
    const customerPassword = 'Customer@123';
    const customer = await User.create({
      email: 'customer@example.com',
      password: customerPassword,
      firstName: 'John',
      lastName: 'Doe',
      phone: '9876543210',
      role: 'customer',
      isEmailVerified: true,
      isActive: true,
      gender: 'male',
      addresses: [{
        name: 'John Doe',
        addressType: 'home',
        address: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
        phone: '9876543210',
        isDefault: true
      }]
    });
    console.log('✅ Sample customer created');
    
    // Create cart and wishlist for users
    await Cart.create({ user: admin._id });
    await Wishlist.create({ user: admin._id });
    await Cart.create({ user: customer._id });
    await Wishlist.create({ user: customer._id });
    
    // 3. Create Categories WITH SLUGS
    const categories = [
      {
        name: 'Earrings',
        slug: generateSlug('Earrings'),
        description: 'Beautiful earrings for all occasions',
        image: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=1200&q=80',
        icon: '💎',
        displayOrder: 1,
        createdBy: admin._id
      },
      {
        name: 'Necklaces',
        slug: generateSlug('Necklaces'),
        description: 'Elegant necklaces and pendants',
        image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&q=80',
        icon: '📿',
        displayOrder: 2,
        createdBy: admin._id
      },
      {
        name: 'Bracelets',
        slug: generateSlug('Bracelets'),
        description: 'Stylish bracelets and bangles',
        image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1200&q=80',
        icon: '💫',
        displayOrder: 3,
        createdBy: admin._id
      },
      {
        name: 'Rings',
        slug: generateSlug('Rings'),
        description: 'Engagement and wedding rings',
        image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1200&q=80',
        icon: '💍',
        displayOrder: 4,
        createdBy: admin._id
      },
      {
        name: 'Brooches',
        slug: generateSlug('Brooches'),
        description: 'Decorative brooches and pins',
        image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1200&q=80',
        icon: '🧷',
        displayOrder: 5,
        createdBy: admin._id
      },
      {
        name: 'Watches',
        slug: generateSlug('Watches'),
        description: 'Luxury and casual watches',
        image: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=1200&q=80',
        icon: '⌚',
        displayOrder: 6,
        createdBy: admin._id
      },
      {
        name: "Men's Jewelry",
        slug: generateSlug("Men's Jewelry"),
        description: 'Jewelry specifically for men',
        image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200&q=80',
        icon: '👔',
        displayOrder: 7,
        createdBy: admin._id
      },
      {
        name: 'Accessories',
        slug: generateSlug('Accessories'),
        description: 'Fashion accessories and complementary items',
        image: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=1200&q=80',
        icon: '👜',
        displayOrder: 8,
        createdBy: admin._id
      }
    ];
    
    const createdCategories = await Category.insertMany(categories);
    console.log('✅ Categories created');
    
    // 4. Create Subcategories WITH SLUGS
    const earringsCategory = createdCategories.find(cat => cat.name === 'Earrings');
    const subcategories = [
      {
        name: 'Stud Earrings',
        slug: generateSlug('Stud Earrings'),
        category: earringsCategory._id,
        description: 'Simple and elegant stud earrings',
        displayOrder: 1,
        createdBy: admin._id
      },
      {
        name: 'Hoops',
        slug: generateSlug('Hoops'),
        category: earringsCategory._id,
        description: 'Circular hoop earrings',
        displayOrder: 2,
        createdBy: admin._id
      },
      {
        name: 'Danglers',
        slug: generateSlug('Danglers'),
        category: earringsCategory._id,
        description: 'Long dangler earrings',
        displayOrder: 3,
        createdBy: admin._id
      }
    ];
    
    const createdSubcategories = await SubCategory.insertMany(subcategories);
    console.log('✅ Subcategories created');
    
    // 5. Create Sample Products WITH SLUGS
    const products = [
      {
        sku: 'GOLD-EARR-001',
        name: '24K Gold Stud Earrings',
        slug: generateSlug('24K Gold Stud Earrings'),
        description: 'Beautiful 24K gold stud earrings with diamond accents. Perfect for daily wear and special occasions.',
        shortDescription: '24K Gold Stud Earrings with Diamond',
        category: earringsCategory._id,
        subCategory: createdSubcategories[0]._id,
        brand: 'Gold Heritage',
        gender: 'female',
        basePrice: 25000,
        sellingPrice: 22500,
        discountType: 'percentage',
        discountValue: 10,
        stockQuantity: 50,
        material: 'gold',
        purity: '24k',
        weight: 4.5,
        isFeatured: true,
        isNewArrival: true,
        tags: ['gold', 'earrings', 'diamond', 'stud', '24k'],
        createdBy: admin._id
      },
      {
        sku: 'SILV-NECK-001',
        name: 'Silver Pendant Necklace',
        slug: generateSlug('Silver Pendant Necklace'),
        description: 'Elegant silver pendant necklace with intricate design. Comes with 18-inch chain.',
        shortDescription: 'Silver Pendant Necklace with Chain',
        category: createdCategories.find(cat => cat.name === 'Necklaces')._id,
        brand: 'Silver Dreams',
        gender: 'unisex',
        basePrice: 8500,
        sellingPrice: 7500,
        discountType: 'percentage',
        discountValue: 12,
        stockQuantity: 30,
        material: 'silver',
        purity: '925',
        weight: 12.5,
        isFeatured: true,
        isNewArrival: true,
        tags: ['silver', 'necklace', 'pendant', 'chain'],
        createdBy: admin._id
      },
      {
        sku: 'PLAT-RING-001',
        name: 'Platinum Diamond Ring',
        slug: generateSlug('Platinum Diamond Ring'),
        description: 'Exquisite platinum ring with brilliant cut diamond. Perfect for engagements.',
        shortDescription: 'Platinum Diamond Engagement Ring',
        category: createdCategories.find(cat => cat.name === 'Rings')._id,
        brand: 'Platinum Elite',
        gender: 'female',
        basePrice: 75000,
        sellingPrice: 67500,
        discountType: 'percentage',
        discountValue: 10,
        stockQuantity: 15,
        material: 'platinum',
        purity: '950',
        weight: 8.2,
        isFeatured: true,
        isBestSeller: true,
        tags: ['platinum', 'ring', 'diamond', 'engagement'],
        createdBy: admin._id
      }
    ];
    
    const createdProducts = await Product.insertMany(products);
    console.log('✅ Sample products created');
    
    // 6. Create Product Images
    const productImages = [
      {
        product: createdProducts[0]._id,
        url: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=1200&q=80',
        altText: '24K Gold Stud Earrings',
        isPrimary: true,
        displayOrder: 1,
        uploadedBy: admin._id
      },
      {
        product: createdProducts[1]._id,
        url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&q=80',
        altText: 'Silver Pendant Necklace',
        isPrimary: true,
        displayOrder: 1,
        uploadedBy: admin._id
      },
      {
        product: createdProducts[2]._id,
        url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1200&q=80',
        altText: 'Platinum Diamond Ring',
        isPrimary: true,
        displayOrder: 1,
        uploadedBy: admin._id
      }
    ];
    
    await ProductImage.insertMany(productImages);
    console.log('✅ Product images created');
    
    // 7. Create Product Gemstones
    const gemstones = [
      {
        product: createdProducts[0]._id,
        name: 'Diamond',
        type: 'Round Brilliant',
        color: 'D',
        clarity: 'VS1',
        carat: 0.25,
        quantity: 2,
        addedBy: admin._id
      },
      {
        product: createdProducts[2]._id,
        name: 'Diamond',
        type: 'Round Brilliant',
        color: 'F',
        clarity: 'VS2',
        carat: 0.75,
        quantity: 1,
        addedBy: admin._id
      }
    ];
    
    await ProductGemstone.insertMany(gemstones);
    console.log('✅ Product gemstones created');
    
    // 8. Create Coupons
    const coupons = [
      {
        code: 'WELCOME10',
        name: 'Welcome Discount',
        description: '10% off on first order',
        discountType: 'percentage',
        discountValue: 10,
        minPurchaseAmount: 1000,
        maxDiscountAmount: 2000,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        usageLimit: 1000,
        usedCount: 0,
        isActive: true,
        createdBy: admin._id
      },
      {
        code: 'DIWALI25',
        name: 'Diwali Special',
        description: '25% off on orders above ₹5000',
        discountType: 'percentage',
        discountValue: 25,
        minPurchaseAmount: 5000,
        maxDiscountAmount: 5000,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        usageLimit: 500,
        usedCount: 0,
        isActive: true,
        createdBy: admin._id
      }
    ];
    
    await Coupon.insertMany(coupons);
    console.log('✅ Coupons created');
    
    // 9. Create Banners
    // One entry per storefront slot. Every image the storefront renders comes
    // from here (or from Categories/Products), so each slot the FE queries must
    // have a banner or that section renders its shared placeholder instead.
    const img = (id, extra = {}) => ({
      url: `https://images.unsplash.com/${id}?w=1600&q=80`,
      ...extra
    });

    const banners = [
      // Homepage hero carousel — Navbar.jsx (page=home, position=top)
      {
        name: 'homepage-carousel',
        title: 'DISCOVER SPARKLE WITH STYLE',
        subheader: 'Whether casual or formal, find the perfect jewelry for every occasion.',
        buttonText: 'Shop Now',
        redirectUrl: '/categories',
        // 'header' matches the "Homepage Top Carousel" admin preset; the
        // storefront filters on it to keep promo cards out of the carousel.
        bannerType: 'header',
        page: 'home',
        position: 'top',
        displayOrder: 1,
        images: [
          img('photo-1515562141207-7a88fb7ce338', { title: 'DISCOVER SPARKLE WITH STYLE', subtitle: 'Timeless pieces for every occasion', displayOrder: 1, isPrimary: true }),
          img('photo-1611652022419-a9419f74343d', { title: 'THE GOLD EDIT', subtitle: 'Handcrafted 22K designs', displayOrder: 2 }),
          img('photo-1599643478518-a784e5dc4c8f', { title: 'DIAMONDS, REIMAGINED', subtitle: 'Brilliance that lasts forever', displayOrder: 3 }),
          img('photo-1573408301185-9146fe634ad0', { title: 'BRIDAL COLLECTION', subtitle: 'For the day you will never forget', displayOrder: 4 })
        ],
        isActive: true,
        createdBy: admin._id
      },
      // Cleopatra hero section — CleopatraGlam.jsx (bannerType=hero)
      {
        name: 'homepage-hero-cleopatra',
        title: 'CLEOPATRA GLAM',
        subheader: 'Bold statement pieces inspired by ancient royalty',
        buttonText: 'Explore Collection',
        redirectUrl: '/categories',
        bannerType: 'hero',
        page: 'home',
        position: 'hero',
        displayOrder: 1,
        images: [img('photo-1602751584552-8ba73aad10e1', { isPrimary: true })],
        isActive: true,
        createdBy: admin._id
      },
      // Promotional card — CleopatraGlam.jsx (bannerType=promotional)
      {
        name: 'homepage-promotional',
        title: 'FESTIVE OFFER',
        subheader: 'Flat 25% off on all diamond jewellery',
        buttonText: 'Grab the Deal',
        redirectUrl: '/categories',
        bannerType: 'promotional',
        page: 'home',
        position: 'top',
        displayOrder: 2,
        images: [img('photo-1535632066927-ab7c9ab60908', { isPrimary: true })],
        isActive: true,
        createdBy: admin._id
      },
      // Explore products strip — ExploreProducts.jsx (position=middle)
      {
        name: 'homepage-middle',
        title: 'EXPLORE OUR WORLD',
        subheader: 'Curated collections for every mood',
        bannerType: 'header',
        page: 'home',
        position: 'middle',
        displayOrder: 1,
        images: [img('photo-1617038220319-276d3cfab638', { isPrimary: true })],
        isActive: true,
        createdBy: admin._id
      },
      // Best-seller sale card — BestSeller.jsx (position=sidebar)
      {
        name: 'homepage-sidebar-sale',
        title: 'BEST SELLERS',
        subheader: 'Loved by thousands of customers',
        buttonText: 'Shop Best Sellers',
        redirectUrl: '/categories',
        bannerType: 'header',
        page: 'home',
        position: 'sidebar',
        displayOrder: 1,
        images: [img('photo-1605100804763-247f67b3557e', { isPrimary: true })],
        isActive: true,
        createdBy: admin._id
      },
      // Pre-footer category tiles — TopFooter.jsx (position=bottom)
      // Moved off `sidebar` so it no longer collides with BestSeller.
      {
        name: 'homepage-bottom-tiles',
        title: 'SHOP BY OCCASION',
        bannerType: 'header',
        page: 'home',
        position: 'bottom',
        displayOrder: 1,
        images: [
          img('photo-1605100804763-247f67b3557e', { title: 'Engagement Rings', displayOrder: 1, isPrimary: true }),
          img('photo-1573408301185-9146fe634ad0', { title: 'Wedding Bands', displayOrder: 2 }),
          img('photo-1599643478518-a784e5dc4c8f', { title: 'Diamond Jewelry', displayOrder: 3 }),
          img('photo-1611652022419-a9419f74343d', { title: 'Luxury Collection', displayOrder: 4 })
        ],
        isActive: true,
        createdBy: admin._id
      },
      // Navbar mega-menu thumbnails — Navbar.jsx (position=menu)
      {
        name: 'navbar-menu-tiles',
        title: 'Navigation Menu Imagery',
        bannerType: 'header',
        page: 'home',
        position: 'menu',
        displayOrder: 1,
        images: [
          img('photo-1515562141207-7a88fb7ce338', { title: 'All Jewellery', displayOrder: 1, isPrimary: true }),
          img('photo-1611652022419-a9419f74343d', { title: 'Gold', displayOrder: 2 }),
          img('photo-1599643478518-a784e5dc4c8f', { title: 'Diamond', displayOrder: 3 }),
          img('photo-1573408301185-9146fe634ad0', { title: 'Bridal', displayOrder: 4 }),
          img('photo-1602751584552-8ba73aad10e1', { title: 'Earrings', displayOrder: 5 }),
          img('photo-1535632066927-ab7c9ab60908', { title: 'Necklaces', displayOrder: 6 })
        ],
        isActive: true,
        createdBy: admin._id
      },
      // Category listing page — Category.jsx
      {
        name: 'category-top',
        title: 'OUR COLLECTIONS',
        subheader: 'Find the piece that speaks to you',
        bannerType: 'header',
        page: 'category',
        position: 'top',
        displayOrder: 1,
        images: [img('photo-1617038220319-276d3cfab638', { isPrimary: true })],
        isActive: true,
        createdBy: admin._id
      },
      {
        name: 'category-bottom',
        title: 'CRAFTED WITH CARE',
        subheader: 'Every piece hallmarked and certified',
        bannerType: 'footer',
        page: 'category',
        position: 'bottom',
        displayOrder: 1,
        images: [img('photo-1602751584552-8ba73aad10e1', { isPrimary: true })],
        isActive: true,
        createdBy: admin._id
      },
      // Brand logo strip — SliderLogo.jsx (bannerType=slider)
      {
        name: 'category-logo-slider',
        title: 'As Seen In',
        bannerType: 'slider',
        page: 'category',
        position: 'middle',
        displayOrder: 1,
        images: [
          img('photo-1515562141207-7a88fb7ce338', { displayOrder: 1, isPrimary: true }),
          img('photo-1611652022419-a9419f74343d', { displayOrder: 2 }),
          img('photo-1599643478518-a784e5dc4c8f', { displayOrder: 3 }),
          img('photo-1573408301185-9146fe634ad0', { displayOrder: 4 }),
          img('photo-1535632066927-ab7c9ab60908', { displayOrder: 5 })
        ],
        isActive: true,
        createdBy: admin._id
      },
      // About page — About.jsx
      {
        name: 'about-top',
        title: 'OUR STORY',
        subheader: 'Three generations of craftsmanship',
        bannerType: 'header',
        page: 'about',
        position: 'top',
        displayOrder: 1,
        images: [img('photo-1573408301185-9146fe634ad0', { isPrimary: true })],
        isActive: true,
        createdBy: admin._id
      },
      {
        name: 'about-bottom',
        title: 'VISIT OUR ATELIER',
        subheader: 'Where every piece begins',
        bannerType: 'footer',
        page: 'about',
        position: 'bottom',
        displayOrder: 1,
        images: [img('photo-1535632066927-ab7c9ab60908', { isPrimary: true })],
        isActive: true,
        createdBy: admin._id
      }
    ];

    await Banner.insertMany(banners);
    console.log(`✅ Banners created (${banners.length} storefront slots)`);
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    // Print the credentials actually used — ADMIN_PASSWORD in .env overrides
    // the default, and printing the default instead is a trap.
    console.log(`- Admin user: ${admin.email} / ${adminPassword}`);
    console.log(`- Sample customer: ${customer.email} / ${customerPassword}`);
    console.log('- Categories: 8 created');
    console.log('- Subcategories: 3 created');
    console.log('- Products: 3 created');
    console.log('- Coupons: WELCOME10, DIWALI25');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
};

// Run seeding
seedDatabase();