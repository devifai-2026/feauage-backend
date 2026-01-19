// src/seeds/seedOrder.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import models - adjust paths based on your actual structure
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderAddress = require('../models/OrderAddress');
const Product = require('../models/Product');
const User = require('../models/User');
const Target = require('../models/Target');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

// Store generated IDs to avoid duplicates within the seed session
const generatedOrderIds = new Set();

// Generate order IDs with manual counter for each date
const generateOrderId = (createdAt, sequenceNumber) => {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Use sequence number instead of counting from database
  return `ORD${year}${month}${day}${String(sequenceNumber).padStart(4, '0')}`;
};

const generateInvoiceNumber = (createdAt, sequenceNumber) => {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `INV${year}${month}${day}${String(sequenceNumber).padStart(4, '0')}`;
};

// Sample order data
const sampleOrders = [
  {
    user: '69408ef0151df3732fbb9c90', // customer@example.com
    subtotal: 45000,
    discount: 2250,
    shippingCharge: 150,
    tax: 8505,
    grandTotal: 51405,
    currency: 'INR',
    paymentMethod: 'razorpay',
    paymentStatus: 'paid',
    razorpayOrderId: 'order_MjYyNzIyNjg2',
    razorpayPaymentId: 'pay_MjYyNzIyODg2',
    shippingProvider: 'shiprocket',
    shiprocketOrderId: 'SR123456789',
    trackingNumber: 'TRACK123456',
    shippingStatus: 'delivered',
    status: 'delivered',
    estimatedDelivery: new Date('2025-12-20'),
    deliveredAt: new Date('2025-12-18'),
    createdAt: new Date('2025-12-15T10:30:00Z')
  },
  {
    user: '69408ef0151df3732fbb9c90',
    subtotal: 67500,
    discount: 6750,
    shippingCharge: 200,
    tax: 12285,
    grandTotal: 73235,
    currency: 'INR',
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    shippingProvider: 'shiprocket',
    shiprocketOrderId: 'SR987654321',
    trackingNumber: 'TRACK654321',
    shippingStatus: 'shipped',
    status: 'shipped',
    estimatedDelivery: new Date('2025-12-22'),
    createdAt: new Date('2025-12-16T14:45:00Z')
  },
  {
    user: '69408ef0151df3732fbb9c90',
    subtotal: 22500,
    discount: 0,
    shippingCharge: 100,
    tax: 4050,
    grandTotal: 26650,
    currency: 'INR',
    paymentMethod: 'razorpay',
    paymentStatus: 'paid',
    razorpayOrderId: 'order_MjYyNzIyNzg2',
    razorpayPaymentId: 'pay_MjYyNzIyOTg2',
    shippingProvider: 'shiprocket',
    shiprocketOrderId: 'SR456789123',
    trackingNumber: 'TRACK789123',
    shippingStatus: 'processing',
    status: 'confirmed',
    estimatedDelivery: new Date('2025-12-25'),
    createdAt: new Date('2025-12-17T09:15:00Z')
  },
  {
    user: '69408ef0151df3732fbb9c90',
    subtotal: 90000,
    discount: 9000,
    shippingCharge: 250,
    tax: 15300,
    grandTotal: 96550,
    currency: 'INR',
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    razorpayOrderId: 'order_MjYyNzIyNzY2',
    razorpayPaymentId: 'pay_MjYyNzIyOTY2',
    shippingProvider: 'shiprocket',
    shiprocketOrderId: 'SR321654987',
    trackingNumber: 'TRACK321654',
    shippingStatus: 'out_for_delivery',
    status: 'shipped',
    estimatedDelivery: new Date('2025-12-19'),
    createdAt: new Date('2025-12-18T16:20:00Z')
  },
  {
    user: '69408ef0151df3732fbb9c90',
    subtotal: 33750,
    discount: 3375,
    shippingCharge: 120,
    tax: 6143,
    grandTotal: 36638,
    currency: 'INR',
    paymentMethod: 'card',
    paymentStatus: 'failed',
    shippingProvider: 'shiprocket',
    shippingStatus: 'pending',
    status: 'pending',
    cancellationReason: 'Payment failed',
    createdAt: new Date('2025-12-19T11:10:00Z')
  },
  {
    user: '69408ef0151df3732fbb9c90',
    subtotal: 56250,
    discount: 5625,
    shippingCharge: 180,
    tax: 10238,
    grandTotal: 61043,
    currency: 'INR',
    paymentMethod: 'razorpay',
    paymentStatus: 'paid',
    razorpayOrderId: 'order_MjYyNzIyNzQ2',
    razorpayPaymentId: 'pay_MjYyNzIyOTQ2',
    shippingProvider: 'shiprocket',
    shiprocketOrderId: 'SR654987321',
    trackingNumber: 'TRACK654987',
    shippingStatus: 'delivered',
    status: 'delivered',
    estimatedDelivery: new Date('2025-12-21'),
    deliveredAt: new Date('2025-12-20'),
    createdAt: new Date('2025-12-20T13:25:00Z')
  }
];

// Sample order items for each order
const sampleOrderItems = [
  // Order 1 items
  [
    {
      order: null, // Will be populated
      product: '69408ef1151df3732fbb9ca6', // 24K Gold Stud Earrings
      quantity: 2,
      price: 22500,
      sku: 'GOLD-EARR-001',
      productName: '24K Gold Stud Earrings',
      productImage: 'earrings.jpg'
    }
  ],
  // Order 2 items
  [
    {
      order: null,
      product: '69408ef1151df3732fbb9ca6',
      quantity: 3,
      price: 22500,
      sku: 'GOLD-EARR-001',
      productName: '24K Gold Stud Earrings',
      productImage: 'earrings.jpg'
    }
  ],
  // Order 3 items
  [
    {
      order: null,
      product: '69408ef1151df3732fbb9ca6',
      quantity: 1,
      price: 22500,
      sku: 'GOLD-EARR-001',
      productName: '24K Gold Stud Earrings',
      productImage: 'earrings.jpg'
    }
  ],
  // Order 4 items
  [
    {
      order: null,
      product: '69408ef1151df3732fbb9ca6',
      quantity: 4,
      price: 22500,
      sku: 'GOLD-EARR-001',
      productName: '24K Gold Stud Earrings',
      productImage: 'earrings.jpg'
    }
  ],
  // Order 5 items
  [
    {
      order: null,
      product: '69408ef1151df3732fbb9ca6',
      quantity: 1.5,
      price: 22500,
      sku: 'GOLD-EARR-001',
      productName: '24K Gold Stud Earrings',
      productImage: 'earrings.jpg'
    }
  ],
  // Order 6 items
  [
    {
      order: null,
      product: '69408ef1151df3732fbb9ca6',
      quantity: 2.5,
      price: 22500,
      sku: 'GOLD-EARR-001',
      productName: '24K Gold Stud Earrings',
      productImage: 'earrings.jpg'
    }
  ]
];

// Sample order addresses
const sampleAddresses = [
  // Shipping and billing addresses for each order
  {
    type: 'shipping',
    name: 'John Doe',
    phone: '9876543210',
    addressLine1: '123 Main Street',
    addressLine2: 'Near Central Park',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    country: 'India',
    email: 'customer@example.com'
  },
  {
    type: 'billing',
    name: 'John Doe',
    phone: '9876543210',
    addressLine1: '123 Main Street',
    addressLine2: 'Near Central Park',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    country: 'India',
    email: 'customer@example.com'
  }
];

// Function to update target progress after seeding
const updateTargetProgress = async () => {
  try {
    const Target = mongoose.model('Target');
    const Order = mongoose.model('Order');
    
    // Get all active revenue targets
    const targets = await Target.find({ 
      targetType: 'revenue', 
      isActive: true 
    });
    
    console.log(`\n🎯 Updating progress for ${targets.length} targets...`);
    
    for (const target of targets) {
      // Calculate total delivered revenue for this target period
      const totalRevenue = await Order.aggregate([
        {
          $match: {
            user: target.userId,
            status: 'delivered',
            createdAt: {
              $gte: target.startDate,
              $lte: target.endDate
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$grandTotal' }
          }
        }
      ]);
      
      const currentValue = totalRevenue[0]?.total || 0;
      
      // Update target with current value
      await Target.findByIdAndUpdate(target._id, {
        currentValue: currentValue,
        lastUpdatedBy: target.userId
      }, { runValidators: true });
      
      // Get updated target to see progress
      const updatedTarget = await Target.findById(target._id);
      console.log(`   ✅ Target ${target._id}: ₹${currentValue.toLocaleString()}/${target.targetValue.toLocaleString()} = ${updatedTarget.progress.toFixed(1)}%`);
    }
    
    console.log('🎯 All targets updated successfully!');
  } catch (error) {
    console.error('❌ Error updating targets:', error);
  }
};

// Seed function
const seedOrders = async () => {
  try {
    // Connect to database
    await connectDB();
    
    console.log('🔍 Checking existing orders...');
    
    // Check if orders already exist
    const existingOrders = await Order.find({});
    if (existingOrders.length > 0) {
      console.log(`⚠️ Found ${existingOrders.length} existing orders`);
      console.log('Auto-deleting existing orders...');
      await Order.deleteMany({});
      await OrderItem.deleteMany({});
      await OrderAddress.deleteMany({});
      console.log('✅ Existing orders deleted');
    }

    console.log('🚀 Starting order seeding...');

    // Verify user exists
    const user = await User.findById('69408ef0151df3732fbb9c90');
    if (!user) {
      console.error('❌ User not found. Please run user seed first.');
      process.exit(1);
    }
    console.log(`✅ Found user: ${user.email}`);

    // Verify product exists
    const product = await Product.findById('69408ef1151df3732fbb9ca6');
    if (!product) {
      console.error('❌ Product not found. Please run product seed first.');
      process.exit(1);
    }
    console.log(`✅ Found product: ${product.name}`);

    // Clear the generated IDs set
    generatedOrderIds.clear();
    
    // Track sequence numbers per date
    const dateSequenceMap = new Map();
    
    // Create orders in sequence
    const createdOrders = [];
    
    // Create orders one by one
    for (let i = 0; i < sampleOrders.length; i++) {
      const orderData = sampleOrders[i];
      const createdAt = orderData.createdAt;
      const dateKey = createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Get or initialize sequence number for this date
      if (!dateSequenceMap.has(dateKey)) {
        dateSequenceMap.set(dateKey, 1);
      } else {
        dateSequenceMap.set(dateKey, dateSequenceMap.get(dateKey) + 1);
      }
      
      const sequenceNumber = dateSequenceMap.get(dateKey);
      
      // Generate order ID and invoice number
      const orderId = generateOrderId(createdAt, sequenceNumber);
      const invoiceNumber = generateInvoiceNumber(createdAt, sequenceNumber);
      
      // Check for duplicates within this seed session
      if (generatedOrderIds.has(orderId)) {
        console.error(`❌ Duplicate order ID generated: ${orderId}`);
        continue;
      }
      
      generatedOrderIds.add(orderId);
      
      // Add the generated IDs to the order data
      const orderDataToSave = {
        ...orderData,
        orderId: orderId,
        invoiceNumber: invoiceNumber,
        updatedAt: orderData.createdAt
      };
      
      // Add a small delay to ensure unique timestamps
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      try {
        // Create order with pre-generated IDs
        const order = await Order.create(orderDataToSave);
        createdOrders.push(order);
        console.log(`✅ Created order: ${order.orderId} (Invoice: ${order.invoiceNumber}) (₹${order.grandTotal}) - ${order.status}`);
        
        // Create order items
        const orderItemsData = sampleOrderItems[i];
        for (const itemData of orderItemsData) {
          const orderItem = await OrderItem.create({
            ...itemData,
            order: order._id
          });
          console.log(`   └─ Item: ${itemData.quantity}x ${itemData.productName} (₹${itemData.price})`);
        }
        
        // Create order addresses
        for (const addressData of sampleAddresses) {
          await OrderAddress.create({
            ...addressData,
            order: order._id
          });
        }
        console.log(`   └─ Addresses created`);
        
      } catch (error) {
        console.error(`❌ Error creating order ${i + 1} (${orderId}):`, error.message);
        if (error.code === 11000) {
          console.error(`   Duplicate key error in database`);
          // Try with next sequence number
          dateSequenceMap.set(dateKey, sequenceNumber + 1);
        }
        // Continue with next order
        continue;
      }
    }

    console.log(`\n🎉 Successfully seeded ${createdOrders.length} orders`);
    
    // Update target progress after all orders are created
    await updateTargetProgress();
    
    // Calculate statistics
    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$grandTotal' },
          deliveredRevenue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, '$grandTotal', 0]
            }
          },
          avgOrderValue: { $avg: '$grandTotal' },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] }
          }
        }
      }
    ]);

    if (stats.length > 0) {
      console.log('\n📊 Order Statistics:');
      console.log(`   📦 Total Orders: ${stats[0].totalOrders}`);
      console.log(`   💰 Total Revenue: ₹${stats[0].totalRevenue.toLocaleString('en-IN')}`);
      console.log(`   🚚 Delivered Revenue: ₹${stats[0].deliveredRevenue.toLocaleString('en-IN')}`);
      console.log(`   📈 Average Order Value: ₹${stats[0].avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
      console.log(`   ✅ Delivered Orders: ${stats[0].deliveredOrders}`);
      console.log(`   🚚 Shipped Orders: ${stats[0].shippedOrders}`);
      console.log(`   ⏳ Pending Orders: ${stats[0].pendingOrders}`);
    }

    // Show target status
    console.log('\n🎯 Target Status:');
    const targets = await Target.find({ targetType: 'revenue', isActive: true });
    if (targets.length > 0) {
      for (const target of targets) {
        console.log(`   • Target: ₹${target.targetValue.toLocaleString()} (${target.period})`);
        console.log(`     Current: ₹${target.currentValue.toLocaleString()}`);
        console.log(`     Progress: ${target.progress.toFixed(1)}%`);
        console.log(`     Status: ${target.status}`);
        console.log(`     Period: ${new Date(target.startDate).toLocaleDateString()} to ${new Date(target.endDate).toLocaleDateString()}`);
      }
    } else {
      console.log('   No active revenue targets found');
    }

    // Show sample for verification
    console.log('\n🔍 Sample Orders for Verification:');
    const sampleOrdersList = await Order.find()
      .populate('user', 'email')
      .sort({ createdAt: -1 })
      .limit(3);
    
    sampleOrdersList.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.orderId} - ₹${order.grandTotal} - ${order.status} - ${order.user?.email || 'N/A'}`);
    });

  } catch (error) {
    console.error('❌ Error seeding orders:', error);
    console.error(error.stack);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
    process.exit(0);
  }
};

// Run the seed function
seedOrders();