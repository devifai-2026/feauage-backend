const nodemailer = require('nodemailer');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"Team Feauag" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

/**
 * Send order shipped email to customer
 * @param {Object} user       - { email, firstName }
 * @param {Object} order      - order document
 * @param {Array}  orderItems - array of order items with product populated
 */
async function sendOrderShippedEmail(user, order, orderItems = []) {
  console.log(`[Mailer] ── Shipped Email ──────────────────────────`);
  console.log(`[Mailer]   To       : ${user.email}`);
  console.log(`[Mailer]   Customer : ${user.firstName || 'N/A'}`);
  console.log(`[Mailer]   Order ID : ${order.orderId}`);
  console.log(`[Mailer]   AWB      : ${order.trackingNumber || order.shiprocketAWB || 'N/A'}`);
  console.log(`[Mailer]   Courier  : ${order.courierName || 'N/A'}`);
  console.log(`[Mailer]   From     : ${FROM}`);

  try {
    const templatePath = path.join(__dirname, '../templates/emails/orderShipped.ejs');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    console.log(`[Mailer]   Template : loaded`);

    const productName = orderItems.length > 0
      ? orderItems.map(i => i.productName || i.name || (i.product && i.product.name) || 'Jewellery').join(', ')
      : 'Your Jewellery';
    console.log(`[Mailer]   Product  : ${productName}`);

    const html = ejs.render(templateContent, {
      customerName: user.firstName || 'Valued Customer',
      orderId: order.orderId,
      productName,
      trackingNumber: order.trackingNumber || order.shiprocketAWB,
      trackingUrl: order.trackingUrl || `https://shiprocket.co/tracking/${order.trackingNumber || order.shiprocketAWB}`,
      courierName: order.courierName || 'Shiprocket',
      websiteUrl: process.env.WEBSITE_URL || 'https://feauage.com',
    });

    console.log(`[Mailer]   Sending via SMTP (${process.env.SMTP_HOST})...`);
    const info = await transporter.sendMail({
      from: FROM,
      to: user.email,
      subject: 'Your Order Has Been Shipped 🚚✨',
      html,
      text: `Hi ${user.firstName}, your order ${order.orderId} has been shipped. Track it at: ${order.trackingUrl}`,
    });

    console.log(`[Mailer]   SUCCESS — MessageId: ${info.messageId}`);
    console.log(`[Mailer] ────────────────────────────────────────────`);
  } catch (error) {
    console.error(`[Mailer]   FAILED — ${error.message}`);
    console.log(`[Mailer] ────────────────────────────────────────────`);
    // Non-fatal — don't throw, just log
  }
}

module.exports = { sendOrderShippedEmail };
