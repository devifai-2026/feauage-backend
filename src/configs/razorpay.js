const Razorpay = require('razorpay');

const razorpay = new Razorpay({
   key_id: process.env.RAZORPAY_KEY_ID || 'your_razorpay_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_razorpay_key_secret'
});

module.exports = razorpay;