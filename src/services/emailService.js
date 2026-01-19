const AWS = require('aws-sdk');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

// Configure AWS SES
const ses = new AWS.SES({
  region: process.env.AWS_SES_REGION || 'ap-south-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

class Email {
  constructor(user, url = '') {
    this.to = user.email;
    this.firstName = user.firstName;
    this.url = url;
    this.from = process.env.AWS_SES_SENDER_EMAIL || 'noreply@jewellery.com';
  }

  // Send actual email
  async send(template, subject, data = {}) {
    try {
      // Read email template
      const templatePath = path.join(__dirname, '../templates/emails', `${template}.ejs`);
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      
      // Render template with data
      const html = ejs.render(templateContent, {
        firstName: this.firstName,
        url: this.url,
        ...data
      });
      
      // Define email params
      const params = {
        Source: this.from,
        Destination: {
          ToAddresses: [this.to]
        },
        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: html
            },
            Text: {
              Charset: 'UTF-8',
              Data: `Hello ${this.firstName}, Please visit ${this.url} to complete the action.`
            }
          },
          Subject: {
            Charset: 'UTF-8',
            Data: subject
          }
        }
      };
      
      // Send email via SES
      const response = await ses.sendEmail(params).promise();
      console.log('Email sent successfully:', response.MessageId);
      
      return response;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  // Send welcome email
  async sendWelcome() {
    await this.send(
      'welcome',
      'Welcome to Jewellery E-commerce! Please verify your email',
      { type: 'verification' }
    );
  }

  // Send welcome email after verification
  async sendWelcomeVerified() {
    await this.send(
      'welcome',
      'Welcome to Jewellery E-commerce!',
      { type: 'verified' }
    );
  }

  // Send password reset email
  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Reset Your Password (Valid for 10 minutes)',
      { type: 'passwordReset' }
    );
  }

  // Send verification email
  async sendVerification() {
    await this.send(
      'verification',
      'Verify Your Email Address',
      { type: 'verification' }
    );
  }

  // Send order confirmation email
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

  // Send order shipped email
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

  // Send order delivered email
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

  // Send payment confirmation email
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

  // Send low stock alert email (to admin)
  async sendLowStockAlert(product, adminEmails) {
    const params = {
      Source: this.from,
      Destination: {
        ToAddresses: adminEmails
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: `
              <h2>Low Stock Alert</h2>
              <p>Product: ${product.name}</p>
              <p>SKU: ${product.sku}</p>
              <p>Current Stock: ${product.stockQuantity}</p>
              <p>Threshold: ${product.lowStockThreshold}</p>
              <p>Please restock this product as soon as possible.</p>
            `
          },
          Text: {
            Charset: 'UTF-8',
            Data: `Low Stock Alert: ${product.name} (SKU: ${product.sku}) has only ${product.stockQuantity} units left.`
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: `Low Stock Alert: ${product.name}`
        }
      }
    };
    
    await ses.sendEmail(params).promise();
  }
}

module.exports = Email;