const axios = require('axios');

class ShippingService {
  constructor() {
    this.baseURL = process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external';
    this.token = null;
    this.tokenExpiry = null;
  }

  // Authenticate with Shiprocket
  async authenticate() {
    try {
      const response = await axios.post(`${this.baseURL}/auth/login`, {
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD
      });
      
      this.token = response.data.token;
      this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      
      return this.token;
    } catch (error) {
      console.error('Shiprocket authentication failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get auth headers
  async getHeaders() {
    if (!this.token || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
    
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  // Create shipment
  async createShipment(orderData) {
    try {
      const headers = await this.getHeaders();
      
      const response = await axios.post(`${this.baseURL}/orders/create/adhoc`, orderData, { headers });
      
      return response.data;
    } catch (error) {
      console.error('Shiprocket shipment creation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Generate AWB (Air Waybill)
  async generateAWB(shipmentId, courierId) {
    try {
      const headers = await this.getHeaders();
      
      const response = await axios.post(`${this.baseURL}/courier/assign/awb`, {
        shipment_id: shipmentId,
        courier_id: courierId
      }, { headers });
      
      return response.data;
    } catch (error) {
      console.error('Shiprocket AWB generation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Pickup schedule
  async schedulePickup(shipmentIds) {
    try {
      const headers = await this.getHeaders();
      
      const response = await axios.post(`${this.baseURL}/courier/generate/pickup`, {
        shipment_id: shipmentIds
      }, { headers });
      
      return response.data;
    } catch (error) {
      console.error('Shiprocket pickup scheduling failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Track shipment
  async trackShipment(awbNumber) {
    try {
      const headers = await this.getHeaders();
      
      const response = await axios.get(`${this.baseURL}/courier/track/awb/${awbNumber}`, { headers });
      
      return response.data;
    } catch (error) {
      console.error('Shiprocket tracking failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Track by shipment ID
  async trackByShipmentId(shipmentId) {
    try {
      const headers = await this.getHeaders();
      
      const response = await axios.get(`${this.baseURL}/courier/track/shipment/${shipmentId}`, { headers });
      
      return response.data;
    } catch (error) {
      console.error('Shiprocket tracking by shipment ID failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Cancel shipment
  async cancelShipment(shipmentId) {
    try {
      const headers = await this.getHeaders();
      
      const response = await axios.post(`${this.baseURL}/orders/cancel/shipment/${shipmentId}`, {}, { headers });
      
      return response.data;
    } catch (error) {
      console.error('Shiprocket cancellation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get shipping charges
  async getShippingCharges(pickupPostcode, deliveryPostcode, weight, dimensions) {
    try {
      const headers = await this.getHeaders();
      
      const response = await axios.post(`${this.baseURL}/courier/serviceability`, {
        pickup_postcode: pickupPostcode,
        delivery_postcode: deliveryPostcode,
        weight,
        ...dimensions
      }, { headers });
      
      return response.data;
    } catch (error) {
      console.error('Shiprocket shipping charges calculation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get available couriers
  async getAvailableCouriers(pickupPostcode, deliveryPostcode, weight) {
    try {
      const headers = await this.getHeaders();
      
      const response = await axios.get(`${this.baseURL}/courier/serviceability`, {
        params: {
          pickup_postcode: pickupPostcode,
          delivery_postcode: deliveryPostcode,
          weight,
          cod: 0
        },
        headers
      });
      
      return response.data;
    } catch (error) {
      console.error('Shiprocket courier availability check failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Create return shipment
  async createReturnShipment(orderId, reason) {
    try {
      const headers = await this.getHeaders();
      
      const response = await axios.post(`${this.baseURL}/orders/create/return`, {
        order_id: orderId,
        reason
      }, { headers });
      
      return response.data;
    } catch (error) {
      console.error('Shiprocket return shipment creation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Generate manifest
  async generateManifest(shipmentIds) {
    try {
      const headers = await this.getHeaders();
      
      const response = await axios.post(`${this.baseURL}/manifests/generate`, {
        shipment_ids: shipmentIds
      }, { headers });
      
      return response.data;
    } catch (error) {
      console.error('Shiprocket manifest generation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Print label
  async printLabel(shipmentIds) {
    try {
      const headers = await this.getHeaders();
      
      const response = await axios.post(`${this.baseURL}/courier/generate/label`, {
        shipment_ids: shipmentIds
      }, { headers });
      
      return response.data;
    } catch (error) {
      console.error('Shiprocket label printing failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Create order data from our order
  static createOrderData(order, items, address) {
    return {
      order_id: order.orderId,
      order_date: new Date(order.createdAt).toISOString().split('T')[0],
      pickup_location: 'Primary',
      channel_id: '',
      comment: '',
      billing_customer_name: address.name,
      billing_last_name: '',
      billing_address: address.addressLine1,
      billing_address_2: address.addressLine2 || '',
      billing_city: address.city,
      billing_pincode: address.pincode,
      billing_state: address.state,
      billing_country: address.country,
      billing_email: address.email || '',
      billing_phone: address.phone,
      shipping_is_billing: true,
      shipping_customer_name: '',
      shipping_last_name: '',
      shipping_address: '',
      shipping_address_2: '',
      shipping_city: '',
      shipping_pincode: '',
      shipping_country: '',
      shipping_state: '',
      shipping_email: '',
      shipping_phone: '',
      order_items: items.map(item => ({
        name: item.productName,
        sku: item.sku,
        units: item.quantity,
        selling_price: item.price,
        discount: '',
        tax: '',
        hsn: 7113
      })),
      payment_method: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
      shipping_charges: order.shippingCharge,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: order.discount,
      sub_total: order.subtotal,
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5
    };
  }
}

module.exports = ShippingService;