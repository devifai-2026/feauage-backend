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

class Email {
  constructor(user, url = '') {
    this.to = user.email;
    this.firstName = user.firstName;
    this.url = url;
    this.from = `"Feauag" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
  }

  async send(template, subject, data = {}) {
    try {
      const templatePath = path.join(__dirname, '../templates/emails', `${template}.ejs`);
      const templateContent = fs.readFileSync(templatePath, 'utf-8');

      const html = ejs.render(templateContent, {
        firstName: this.firstName,
        url: this.url,
        ...data
      });

      const info = await transporter.sendMail({
        from: this.from,
        to: this.to,
        subject,
        html,
        text: `Hello ${this.firstName}, Please visit ${this.url} to complete the action.`,
      });

      console.log(`[EmailService] Sent "${subject}" to ${this.to} — MessageId: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`[EmailService] Failed to send "${subject}" to ${this.to}:`, error.message);
      throw error;
    }
  }

  async sendWelcome() {
    await this.send(
      'welcome',
      'Welcome to Feauag! Please verify your email',
      { type: 'verification' }
    );
  }

  async sendWelcomeVerified() {
    await this.send(
      'welcome',
      'Welcome to Feauag!',
      { type: 'verified' }
    );
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Reset Your Password (Valid for 10 minutes)',
      { type: 'passwordReset' }
    );
  }

  async sendVerification() {
    await this.send(
      'verification',
      'Verify Your Email Address',
      { type: 'verification' }
    );
  }

  async sendOrderConfirmation(order, orderItems) {
    await this.send(
      'orderConfirmation',
      `Order Confirmation - ${order.orderId}`,
      {
        type: 'orderConfirmation',
        order,
        orderItems,
        date: new Date(order.createdAt).toLocaleDateString()
      }
    );
  }

  async sendOrderShipped(order, trackingNumber) {
    await this.send(
      'orderShipped',
      `Your Order #${order.orderId} Has Been Shipped!`,
      {
        type: 'orderShipped',
        order,
        trackingNumber,
        estimatedDelivery: order.estimatedDelivery
          ? new Date(order.estimatedDelivery).toLocaleDateString()
          : 'Soon'
      }
    );
  }

  async sendOrderDelivered(order) {
    await this.send(
      'orderDelivered',
      `Your Order #${order.orderId} Has Been Delivered!`,
      {
        type: 'orderDelivered',
        order,
        date: new Date(order.deliveredAt).toLocaleDateString()
      }
    );
  }

  async sendPaymentConfirmation(order) {
    await this.send(
      'paymentConfirmation',
      `Payment Confirmed - Order #${order.orderId}`,
      {
        type: 'paymentConfirmation',
        order,
        date: new Date().toLocaleDateString()
      }
    );
  }

  async sendLowStockAlert(product, adminEmails) {
    const html = `
      <h2>Low Stock Alert</h2>
      <p>Product: ${product.name}</p>
      <p>SKU: ${product.sku}</p>
      <p>Current Stock: ${product.stockQuantity}</p>
      <p>Threshold: ${product.lowStockThreshold}</p>
      <p>Please restock this product as soon as possible.</p>
    `;

    await transporter.sendMail({
      from: this.from,
      to: adminEmails,
      subject: `Low Stock Alert: ${product.name}`,
      html,
      text: `Low Stock Alert: ${product.name} (SKU: ${product.sku}) has only ${product.stockQuantity} units left.`,
    });
  }
}

module.exports = Email;
