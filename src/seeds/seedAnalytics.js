const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Analytics = require('../models/Analytics');
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Connect to DB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
});

// Generate random session ID without crypto
const generateSessionId = () => {
  // Alternative method without crypto
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return `sess_${timestamp}_${random}`.substring(0, 32);
};

// Generate random IP address
const generateRandomIP = () => {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
};

// Generate random user agent
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.210 Mobile Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Generate random referrer
const referrers = [
  'https://www.google.com/',
  'https://www.facebook.com/',
  'https://www.instagram.com/',
  'https://www.pinterest.com/',
  'direct',
  'https://internal.jewellery.com/',
  null
];

// Generate random timestamp within last 90 days
const generateRandomDate = (daysBack = 90) => {
  const now = new Date();
  const past = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
};

// Search queries for metadata
const searchQueries = [
  'gold earrings',
  'diamond necklace',
  'wedding rings',
  'silver bracelet',
  'men watch',
  'platinum jewellery',
  'birthday gift',
  'engagement ring',
  'traditional jewellery',
  'modern designs'
];

const seedAnalytics = async () => {
  try {
    console.log('🌱 Seeding analytics data...');
    
    // Clear existing analytics data
    try {
      await Analytics.deleteMany({});
      console.log('✅ Analytics data cleared');
    } catch (error) {
      console.log('⚠️  Could not clear analytics:', error.message);
    }
    
    // Get existing users, products, and categories
    const users = await User.find({}).limit(5);
    const products = await Product.find({});
    const categories = await Category.find({});
    
    if (users.length === 0 || products.length === 0) {
      console.log('❌ Need users and products to create analytics data');
      process.exit(1);
    }
    
    console.log(`📊 Found ${users.length} users, ${products.length} products, ${categories.length} categories`);
    
    const analyticsData = [];
    const sessionCache = {}; // Cache for session IDs
    
    // Create some session IDs first
    const sessionIds = [];
    for (let i = 0; i < 50; i++) {
      sessionIds.push(generateSessionId());
    }
    
    // Generate analytics for last 30 days
    for (let i = 0; i < 300; i++) { // Reduced to 300 for faster seeding
      const user = users[Math.floor(Math.random() * users.length)];
      const product = products[Math.floor(Math.random() * products.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      // Use cached session IDs for realistic session patterns
      let sessionId;
      if (Math.random() > 0.3 && Object.keys(sessionCache).length > 0) {
        // Reuse existing session
        const existingSessions = Object.keys(sessionCache);
        sessionId = existingSessions[Math.floor(Math.random() * existingSessions.length)];
      } else {
        // Create new session
        sessionId = sessionIds[Math.floor(Math.random() * sessionIds.length)];
      }
      
      // Track this session's user
      if (!sessionCache[sessionId]) {
        sessionCache[sessionId] = {
          user: Math.random() > 0.2 ? user._id : null,
          events: 0
        };
      }
      sessionCache[sessionId].events++;
      
      // Random event type with weighted probabilities
      const eventTypes = [
        { type: 'page_view', weight: 0.3 },
        { type: 'product_view', weight: 0.25 },
        { type: 'category_view', weight: 0.15 },
        { type: 'search', weight: 0.1 },
        { type: 'add_to_cart', weight: 0.08 },
        { type: 'add_to_wishlist', weight: 0.05 },
        { type: 'checkout_start', weight: 0.04 },
        { type: 'checkout_complete', weight: 0.02 },
        { type: 'purchase', weight: 0.01 }
      ];
      
      let random = Math.random();
      let selectedType = 'page_view';
      for (const eventType of eventTypes) {
        if (random < eventType.weight) {
          selectedType = eventType.type;
          break;
        }
        random -= eventType.weight;
      }
      
      // Determine entity based on event type
      let entityId = null;
      let entityType = null;
      let metadata = {};
      
      switch (selectedType) {
        case 'product_view':
        case 'add_to_cart':
        case 'add_to_wishlist':
          entityId = product._id;
          entityType = 'Product';
          metadata = {
            productName: product.name,
            price: product.sellingPrice,
            category: product.category
          };
          break;
          
        case 'category_view':
          entityId = category._id;
          entityType = 'Category';
          metadata = {
            categoryName: category.name
          };
          break;
          
        case 'search':
          metadata = {
            query: searchQueries[Math.floor(Math.random() * searchQueries.length)],
            resultsCount: Math.floor(Math.random() * 100) + 10
          };
          break;
          
        case 'checkout_start':
        case 'checkout_complete':
        case 'purchase':
          if (Math.random() > 0.3) {
            entityId = product._id;
            entityType = 'Product';
            metadata = {
              productName: product.name,
              price: product.sellingPrice,
              quantity: Math.floor(Math.random() * 3) + 1,
              orderValue: product.sellingPrice * (Math.floor(Math.random() * 3) + 1)
            };
          }
          break;
      }
      
      const timestamp = generateRandomDate(30); // Last 30 days
      
      analyticsData.push({
        type: selectedType,
        entityId: entityId,
        entityType: entityType,
        user: sessionCache[sessionId].user,
        sessionId: sessionId,
        ipAddress: generateRandomIP(),
        userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
        referrer: referrers[Math.floor(Math.random() * referrers.length)],
        timestamp: timestamp,
        metadata: metadata
      });
    }
    
    // Insert analytics data in batches
    const batchSize = 100;
    console.log(`📦 Inserting ${analyticsData.length} analytics events...`);
    
    for (let i = 0; i < analyticsData.length; i += batchSize) {
      const batch = analyticsData.slice(i, i + batchSize);
      await Analytics.insertMany(batch);
      console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(analyticsData.length/batchSize)}`);
    }
    
    console.log('🎉 Analytics seeding completed successfully!');
    console.log('\n📊 Generated analytics summary:');
    
    // Show some statistics
    const totalEvents = await Analytics.countDocuments();
    const uniqueSessions = await Analytics.distinct('sessionId').then(sessions => sessions.length);
    const eventsByType = await Analytics.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log(`- Total events: ${totalEvents}`);
    console.log(`- Unique sessions: ${uniqueSessions}`);
    console.log('- Events by type:');
    eventsByType.forEach(event => {
      console.log(`  ${event._id}: ${event.count} (${Math.round((event.count/totalEvents)*100)}%)`);
    });
    
    // Test the analytics methods
    console.log('\n🧪 Testing analytics methods:');
    
    // Test daily stats
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    
    try {
      const dailyStats = await Analytics.getDailyStats(startDate, endDate);
      console.log(`- Daily stats (last 7 days): ${dailyStats.length} records`);
    } catch (error) {
      console.log(`- Daily stats: ${error.message}`);
    }
    
    if (products.length > 0) {
      try {
        const productAnalytics = await Analytics.getProductAnalytics(products[0]._id, startDate, endDate);
        console.log(`- Product analytics for ${products[0].name}: ${productAnalytics.length} days of data`);
      } catch (error) {
        console.log(`- Product analytics: ${error.message}`);
      }
    }
    
    try {
      const popularProducts = await Analytics.getPopularProducts(5, 30);
      console.log(`- Popular products (last 30 days): ${popularProducts.length} products`);
    } catch (error) {
      console.log(`- Popular products: ${error.message}`);
    }
    
    console.log('\n✅ Analytics seeding completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding analytics:', error.message);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
};

// Run seeding
seedAnalytics();