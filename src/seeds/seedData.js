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
    const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123456', 12);
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
    const customerPassword = await bcrypt.hash('Customer@123', 12);
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
        image: 'https://example.com/earrings.jpg',
        icon: '💎',
        displayOrder: 1,
        createdBy: admin._id
      },
      {
        name: 'Necklaces',
        slug: generateSlug('Necklaces'),
        description: 'Elegant necklaces and pendants',
        image: 'https://example.com/necklaces.jpg',
        icon: '📿',
        displayOrder: 2,
        createdBy: admin._id
      },
      {
        name: 'Bracelets',
        slug: generateSlug('Bracelets'),
        description: 'Stylish bracelets and bangles',
        image: 'https://example.com/bracelets.jpg',
        icon: '💫',
        displayOrder: 3,
        createdBy: admin._id
      },
      {
        name: 'Rings',
        slug: generateSlug('Rings'),
        description: 'Engagement and wedding rings',
        image: 'https://example.com/rings.jpg',
        icon: '💍',
        displayOrder: 4,
        createdBy: admin._id
      },
      {
        name: 'Brooches',
        slug: generateSlug('Brooches'),
        description: 'Decorative brooches and pins',
        image: 'https://example.com/brooches.jpg',
        icon: '🧷',
        displayOrder: 5,
        createdBy: admin._id
      },
      {
        name: 'Watches',
        slug: generateSlug('Watches'),
        description: 'Luxury and casual watches',
        image: 'https://example.com/watches.jpg',
        icon: '⌚',
        displayOrder: 6,
        createdBy: admin._id
      },
      {
        name: "Men's Jewelry",
        slug: generateSlug("Men's Jewelry"),
        description: 'Jewelry specifically for men',
        image: 'https://example.com/mens-jewelry.jpg',
        icon: '👔',
        displayOrder: 7,
        createdBy: admin._id
      },
      {
        name: 'Accessories',
        slug: generateSlug('Accessories'),
        description: 'Fashion accessories and complementary items',
        image: 'https://example.com/accessories.jpg',
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
        url: 'https://example.com/gold-earrings-1.jpg',
        altText: '24K Gold Stud Earrings',
        isPrimary: true,
        displayOrder: 1,
        uploadedBy: admin._id
      },
      {
        product: createdProducts[1]._id,
        url: 'https://example.com/silver-necklace-1.jpg',
        altText: 'Silver Pendant Necklace',
        isPrimary: true,
        displayOrder: 1,
        uploadedBy: admin._id
      },
      {
        product: createdProducts[2]._id,
        url: 'https://example.com/platinum-ring-1.jpg',
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
    const banners = [
      {
        title: 'Summer Collection 2024',
        subtitle: 'Up to 40% off on Gold Jewelry',
        image: 'https://example.com/banner1.jpg',
        mobileImage: 'https://example.com/banner1-mobile.jpg',
        linkType: 'category',
        linkTarget: earringsCategory._id,
        page: 'home',
        position: 'top',
        displayOrder: 1,
        isActive: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBy: admin._id
      },
      {
        title: 'New Arrivals',
        subtitle: 'Latest Designs Just Landed',
        image: 'https://example.com/banner2.jpg',
        mobileImage: 'https://example.com/banner2-mobile.jpg',
        linkType: 'collection',
        linkTarget: 'new-arrivals',
        page: 'home',
        position: 'middle',
        displayOrder: 2,
        isActive: true,
        createdBy: admin._id
      }
    ];
    
    await Banner.insertMany(banners);
    console.log('✅ Banners created');
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- Admin user: admin@jewellery.com / Admin@123456');
    console.log('- Sample customer: customer@example.com / Customer@123');
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