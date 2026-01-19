const app = require('./app');
const dotenv = require('dotenv');
const connectDB = require('./configs/database');
const { initializeSocket } = require('./configs/socket');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Function to display all endpoints with base URL
function displayAllEndpoints() {
  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;
  const env = process.env.NODE_ENV || 'development';
  
  console.log('\n' + '='.repeat(70));
  console.log(`🚀 ${env.toUpperCase()} SERVER STARTED SUCCESSFULLY`);
  console.log('='.repeat(70));
  
  // Server info
  console.log(`📡 Server URL: ${baseUrl}`);
  console.log(`⚙️  Environment: ${env}`);
  console.log(`📅 Started at: ${new Date().toLocaleString()}`);
  console.log(`🔌 Socket.io: ${initializeSocket ? '✅ Enabled' : '❌ Disabled'}`);
  
  // AWS Info
  console.log('\n🔧 AWS CONFIGURATION:');
  console.log(`   S3 Bucket: ${process.env.AWS_S3_BUCKET_NAME || 'Not configured'}`);
  console.log(`   SES Sender: ${process.env.AWS_SES_SENDER_EMAIL || 'Not configured'}`);
  console.log(`   Region: ${process.env.AWS_REGION || 'Not configured'}`);
  
  // Database Info
  console.log('\n🗄️  DATABASE:');
  console.log(`   MongoDB: ${process.env.MONGODB_URI ? '✅ Connected' : '❌ Not configured'}`);
  
  // Payment Info
  console.log('\n💳 PAYMENT GATEWAYS:');
  console.log(`   Razorpay: ${process.env.RAZORPAY_KEY_ID ? '✅ Configured' : '❌ Not configured'}`);
  
  // Get and display all routes
  try {
    // Extract routes from app
    const routes = [];
    const baseUrl = `http://localhost:${PORT}`;
    
    function processStack(stack, path = '') {
      stack.forEach((middleware) => {
        if (middleware.route) {
          // Regular route
          const methods = Object.keys(middleware.route.methods)
            .map(method => method.toUpperCase())
            .join(', ');
          const routePath = path + middleware.route.path;
          routes.push({
            method: methods,
            path: routePath,
            fullUrl: `${baseUrl}${routePath}`
          });
        } else if (middleware.name === 'router' || middleware.name === 'bound dispatch') {
          // Router middleware
          if (middleware.handle && middleware.handle.stack) {
            const routerPath = path + (middleware.regexp.source === '^\\/?(?=\\/|$)' ? '' : '');
            processStack(middleware.handle.stack, routerPath);
          }
        }
      });
    }
    
    if (app._router && app._router.stack) {
      processStack(app._router.stack);
      
      console.log('\n📋 AVAILABLE API ENDPOINTS:');
      console.log('-'.repeat(70));
      
      // Group routes by prefix
      const groupedRoutes = {};
      routes.forEach(route => {
        if (route.path === '/api/v1/health' || route.path === '/api/v1/endpoints') return;
        
        const parts = route.path.split('/');
        const prefix = parts.length > 3 ? `${parts[1]}/${parts[2]}/${parts[3]}` : 'other';
        if (!groupedRoutes[prefix]) groupedRoutes[prefix] = [];
        groupedRoutes[prefix].push(route);
      });
      
      // Display routes by group
      const sortedPrefixes = Object.keys(groupedRoutes).sort();
      sortedPrefixes.forEach(prefix => {
        const groupName = prefix === 'other' ? 'Other Routes' : `/${prefix}`;
        console.log(`\n${groupName}:`);
        groupedRoutes[prefix].forEach((route, index) => {
          console.log(`  ${index + 1}. ${route.method.padEnd(8)} ${route.fullUrl}`);
        });
      });
      
      console.log('-'.repeat(70));
      console.log(`Total API endpoints: ${routes.length}`);
      
      // Display special endpoints
      console.log('\n🔗 UTILITY ENDPOINTS:');
      console.log(`   • Health Check: ${baseUrl}/api/v1/health`);
      console.log(`   • All Endpoints: ${baseUrl}/api/v1/endpoints`);
      console.log(`   • Socket.io: ${baseUrl.replace('http', 'ws')} (WebSocket)`);
      
    } else {
      console.log('\n⚠️  Could not extract routes. App router not initialized yet.');
    }
    
  } catch (error) {
    console.log('\n⚠️  Could not load routes:', error.message);
  }
  
  // AWS SDK Warning (if using AWS SDK v2)
  if (process.env.AWS_ACCESS_KEY_ID) {
    console.log('\n⚠️  AWS SDK v2 Warning: Consider migrating to v3 for long-term support');
  }
  
  console.log('='.repeat(70) + '\n');
}

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n✅ Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`📦 S3 Bucket: ${process.env.AWS_S3_BUCKET_NAME}`);
  console.log(`📧 SES Sender: ${process.env.AWS_SES_SENDER_EMAIL}`);
  
  // Display all endpoints after server starts
  displayAllEndpoints();
});

// Initialize Socket.io
if (initializeSocket) {
  initializeSocket(server);
  console.log('🔌 Socket.io initialized successfully');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('\n❌ UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('\n❌ UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('\n👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});

module.exports = server;