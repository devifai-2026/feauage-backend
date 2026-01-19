🛍️ Feaug E-commerce Backend
A complete, production-ready jewellery e-commerce API built with Node.js, Express.js, and MongoDB. This backend provides all the necessary APIs for a full-featured online jewellery store with admin dashboard, customer features, payment integration, and more.

📋 Table of Contents
Features

Tech Stack

Prerequisites

Installation

Environment Variables

Database Setup

Running the Application

API Documentation

Project Structure

Testing

Deployment

Contributing

License

✨ Features
👤 User Features
User Authentication & Authorization (JWT-based)

Registration with email verification

Login/Logout functionality

Forgot password & reset password

Profile management

Address management

🛒 E-commerce Features
Product Management

Product catalog with categories and subcategories

Advanced search and filtering

Product reviews and ratings

Featured products & new arrivals

Product variants (materials, purity, weight)

Shopping Experience

Shopping cart management

Wishlist functionality

Coupon/discount system

Order management

Order tracking

Payment Integration

Razorpay payment gateway

Payment verification

Order confirmation

👨‍💼 Admin Features
Dashboard Analytics

Sales statistics and reports

Order management

Customer management

Low stock alerts

Content Management

Product CRUD operations

Category and subcategory management

Banner management

Coupon management

Inventory Management

Stock management

Product variants

Pricing management

🚀 Additional Features
File Uploads (AWS S3 & local storage)

Email Notifications (Order confirmations, password reset)

Redis Caching for improved performance

Security Features (Helmet, rate limiting, XSS protection)

API Documentation (Postman collection included)

🛠️ Tech Stack
Backend:

Node.js

Express.js

MongoDB with Mongoose

JWT for authentication

Bcrypt.js for password hashing

File Storage:

AWS S3 (Production)

Local file system (Development)

Multer for file uploads

Payments:

Razorpay Integration

Email:

Nodemailer with AWS SES

Security:

Helmet.js

Express Rate Limit

XSS Clean

Express Mongo Sanitize

Development Tools:

Nodemon

Dotenv

Winston (Logging)

📦 Prerequisites
Before you begin, ensure you have installed:

Node.js (v14 or higher)

npm or yarn

MongoDB (Local or MongoDB Atlas)

Redis (Optional, for caching)

🚀 Installation
Clone the repository

bash
git clone <repository-url>
cd feauage-backend
Install dependencies

bash
npm install
Set up environment variables

bash
cp .env.example .env
# Edit .env with your configuration
Set up the database

bash
npm run seed
Start the development server

bash
npm run dev
🔧 Environment Variables
Create a .env file in the root directory:

env
# Server Configuration
NODE_ENV=development
PORT=5000
SERVER_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/feauage-ecommerce
MONGODB_URI_DEV=mongodb://localhost:27017/feauage-ecommerce-dev

# JWT
JWT_SECRET=your_super_strong_jwt_secret_key_min_32_chars
JWT_EXPIRES_IN=30d
JWT_COOKIE_EXPIRES_IN=30

# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# AWS Services (Optional - for S3 file uploads)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=jewellery-ecommerce-uploads
AWS_SES_SENDER_EMAIL=noreply@yourdomain.com
AWS_SES_REGION=ap-south-1

# Redis (Optional - for caching)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Admin Credentials
ADMIN_EMAIL=admin@jewellery.com
ADMIN_PASSWORD=Admin@123456
ADMIN_NAME=Super Admin

# Security
BCRYPT_SALT_ROUNDS=12
SESSION_SECRET=your_session_secret
CORS_ORIGIN=http://localhost:3000
🗄️ Database Setup
MongoDB Setup Options:
Option 1: MongoDB Atlas (Cloud)

Create a free account at MongoDB Atlas

Create a new cluster

Get your connection string

Update MONGODB_URI in .env

Option 2: Local MongoDB

bash
# Install MongoDB locally
# Then update .env with:
MONGODB_URI=mongodb://localhost:27017/feauage-ecommerce
Seed the Database:
bash
npm run seed
This will create:

Admin user: admin@jewellery.com / Admin@123456

Sample customer: customer@example.com / Customer@123

Sample categories, products, coupons, and banners

🏃 Running the Application
Development Mode
bash
npm run dev
Server runs at: http://localhost:5000

Production Mode
bash
npm start
Available Scripts
bash
npm run dev       # Start development server with nodemon
npm start         # Start production server
npm run seed      # Seed database with sample data
npm test          # Run tests (if configured)
📚 API Documentation
Base URL
text
http://localhost:5000/api/v1
Authentication
All private endpoints require a JWT token in the Authorization header:

text
Authorization: Bearer <your_jwt_token>
API Endpoints
🔐 Authentication
Method	Endpoint	Description	Auth Required
POST	/auth/register	Register new user	No
POST	/auth/login	Login user	No
GET	/auth/me	Get current user	Yes
PATCH	/auth/update-me	Update profile	Yes
POST	/auth/forgot-password	Forgot password	No
👤 User Management
Method	Endpoint	Description	Auth Required
GET	/users/addresses	Get user addresses	Yes
POST	/users/addresses	Add new address	Yes
GET	/users/dashboard/stats	Get user dashboard stats	Yes
🛍️ Products
Method	Endpoint	Description	Auth Required
GET	/products	Get all products	No
GET	/products/:id	Get single product	No
GET	/products/search	Search products	No
GET	/products/featured	Get featured products	No
GET	/products/new-arrivals	Get new arrivals	No
GET	/products/category/:slug	Get products by category	No
🛒 Cart
Method	Endpoint	Description	Auth Required
GET	/cart	Get cart items	Yes
POST	/cart/items	Add to cart	Yes
PATCH	/cart/items/:id	Update cart item	Yes
POST	/cart/apply-coupon	Apply coupon	Yes
DELETE	/cart	Clear cart	Yes
📦 Orders
Method	Endpoint	Description	Auth Required
POST	/orders	Create order	Yes
GET	/orders	Get user orders	Yes
GET	/orders/:id	Get single order	Yes
PATCH	/orders/:id/cancel	Cancel order	Yes
POST	/orders/:id/create-payment	Create payment order	Yes
❤️ Wishlist
Method	Endpoint	Description	Auth Required
GET	/wishlist	Get wishlist	Yes
POST	/wishlist/items	Add to wishlist	Yes
DELETE	/wishlist/items/:id	Remove from wishlist	Yes
⭐ Reviews
Method	Endpoint	Description	Auth Required
POST	/reviews	Create review	Yes
GET	/reviews/product/:id	Get product reviews	No
👨‍💼 Admin (Protected)
Method	Endpoint	Description	Auth Required
GET	/admin/dashboard/stats	Admin dashboard stats	Yes (Admin)
GET	/admin/products	Get all products (admin)	Yes (Admin)
POST	/admin/products	Create product	Yes (Admin)
GET	/admin/orders	Get all orders (admin)	Yes (Admin)
PATCH	/admin/orders/:id/status	Update order status	Yes (Admin)
POST	/admin/coupons	Create coupon	Yes (Admin)
POST	/admin/categories	Create category	Yes (Admin)
POST	/admin/banners	Create banner	Yes (Admin)
💳 Payments
Method	Endpoint	Description	Auth Required
POST	/payments/verify	Verify payment	Yes
🩺 Health Check
Method	Endpoint	Description	Auth Required
GET	/health	Health check	No
📁 Project Structure
text
feauage-backend/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Custom middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── seeds/           # Database seed files
│   ├── app.js           # Express app configuration
│   └── server.js        # Server entry point
├── uploads/             # Local file uploads (development)
├── public/              # Static files
├── tests/               # Test files
├── .env                 # Environment variables
├── .env.example         # Environment variables example
├── package.json
└── README.md
🧪 Testing
Run Tests
bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
Test Structure
text
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/           # End-to-end tests
🚀 Deployment
Production Build
bash
# Install production dependencies
npm ci --only=production

# Set NODE_ENV to production
export NODE_ENV=production

# Start the server
npm start
Docker Deployment
dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
PM2 Process Manager
bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start src/server.js --name feauage-backend

# Save PM2 process list
pm2 save

# Set up PM2 to start on system boot
pm2 startup
🤝 Contributing
Fork the repository

Create your feature branch (git checkout -b feature/amazing-feature)

Commit your changes (git commit -m 'Add some amazing feature')

Push to the branch (git push origin feature/amazing-feature)

Open a Pull Request

Development Guidelines
Follow the existing code style

Write meaningful commit messages

Add tests for new features

Update documentation as needed

📄 License
This project is licensed under the MIT License - see the LICENSE file for details.


Happy Coding! 🎉 