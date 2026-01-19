const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

class PaymentService {
  // Create Razorpay order
  static async createOrder(amount, receipt, notes = {}) {
    try {
      const options = {
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        receipt,
        notes
      };
      
      const order = await razorpay.orders.create(options);
      return order;
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw error;
    }
  }

  // Verify payment signature
  static verifyPayment(orderId, paymentId, signature) {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');
    
    return expectedSignature === signature;
  }

  // Fetch payment details
  static async getPaymentDetails(paymentId) {
    try {
      const payment = await razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error('Error fetching payment details:', error);
      throw error;
    }
  }

  // Create refund
  static async createRefund(paymentId, amount, notes = {}) {
    try {
      const refund = await razorpay.payments.refund(paymentId, {
        amount: Math.round(amount * 100), // Convert to paise
        notes
      });
      return refund;
    } catch (error) {
      console.error('Error creating refund:', error);
      throw error;
    }
  }

  // Fetch refund details
  static async getRefundDetails(refundId) {
    try {
      const refund = await razorpay.refunds.fetch(refundId);
      return refund;
    } catch (error) {
      console.error('Error fetching refund details:', error);
      throw error;
    }
  }

  // Verify webhook signature
  static verifyWebhookSignature(body, signature) {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');
    
    return expectedSignature === signature;
  }

  // Get payment link
  static async createPaymentLink(amount, description, customer, notes = {}) {
    try {
      const paymentLink = await razorpay.paymentLink.create({
        amount: Math.round(amount * 100),
        currency: 'INR',
        accept_partial: false,
        description,
        customer,
        notes,
        reminder_enable: true,
        callback_url: process.env.RAZORPAY_CALLBACK_URL,
        callback_method: 'get'
      });
      
      return paymentLink;
    } catch (error) {
      console.error('Error creating payment link:', error);
      throw error;
    }
  }

  // Capture payment (for cards)
  static async capturePayment(paymentId, amount) {
    try {
      const payment = await razorpay.payments.capture(
        paymentId,
        Math.round(amount * 100)
      );
      return payment;
    } catch (error) {
      console.error('Error capturing payment:', error);
      throw error;
    }
  }

  // Get order details
  static async getOrderDetails(orderId) {
    try {
      const order = await razorpay.orders.fetch(orderId);
      return order;
    } catch (error) {
      console.error('Error fetching order details:', error);
      throw error;
    }
  }

  // Get all payments for an order
  static async getOrderPayments(orderId) {
    try {
      const payments = await razorpay.orders.fetchPayments(orderId);
      return payments;
    } catch (error) {
      console.error('Error fetching order payments:', error);
      throw error;
    }
  }
}

module.exports = {
  razorpay,
  PaymentService
};