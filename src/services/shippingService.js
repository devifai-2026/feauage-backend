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



  // Centralized method to process shipment for an order
  async processShipmentForOrder(orderId) {
    try {
      console.log(`[ShippingService] Starting automated shipment process for Order: ${orderId}`);

      // Need to require models here to avoid circular dependency issues
      const Order = require('../models/Order');
      const OrderItem = require('../models/OrderItem');
      const OrderAddress = require('../models/OrderAddress');

      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error(`Order not found for Shiprocket shipment: ${orderId}`);
      }

      // 1. Validate Order State
      if (order.shiprocketAWB) {
        console.log(`[ShippingService] Order ${order.orderId} already has AWB: ${order.shiprocketAWB}. Skipping.`);
        return { success: true, message: 'Shipment already created', order };
      }

      // Get order items
      const orderItems = await OrderItem.find({ order: orderId });
      if (!orderItems.length) {
        throw new Error(`No order items found for Shiprocket shipment: ${orderId}`);
      }

      // Get shipping address
      const shippingAddress = await OrderAddress.findOne({ order: orderId, type: 'shipping' });
      if (!shippingAddress) {
        throw new Error(`No shipping address found for Shiprocket shipment: ${orderId}`);
      }

      // 2. Prepare Shiprocket Order Payload
      const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';
      console.log(`[ShippingService] Creating Shiprocket order for ${order.orderId} from ${pickupLocation}`);

      const shiprocketOrderData = {
        order_id: order.orderId,
        order_date: new Date(order.createdAt).toISOString().split('T')[0],
        pickup_location: pickupLocation,
        channel_id: '',
        comment: `Order from Feauage Jewelry - ${order.orderId}`,
        billing_customer_name: shippingAddress.name?.split(' ')[0] || 'Customer',
        billing_last_name: shippingAddress.name?.split(' ').slice(1).join(' ') || '',
        billing_address: shippingAddress.addressLine1,
        billing_address_2: shippingAddress.landmark || '',
        billing_city: shippingAddress.city,
        billing_pincode: shippingAddress.pincode,
        billing_state: shippingAddress.state,
        billing_country: shippingAddress.country || 'India',
        billing_email: shippingAddress.email || '',
        billing_phone: shippingAddress.phone,
        shipping_is_billing: true,
        order_items: orderItems.map(item => ({
          name: item.productName || 'Jewelry Item',
          sku: item.sku || `SKU-${item._id}`,
          units: item.quantity,
          selling_price: item.price,
          discount: '',
          tax: '',
          hsn: 7113 // HSN code for jewelry
        })),
        payment_method: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
        shipping_charges: order.shippingCharge || 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: order.discount || 0,
        sub_total: order.subtotal,
        length: 10,
        breadth: 10,
        height: 5,
        weight: 0.3 // Default weight for jewelry
      };

      // 3. Create Order in Shiprocket
      let shiprocketOrder;
      // Check if we already have a shiprocket order ID but no AWB (retry scenario)
      if (order.shiprocketOrderId) {
        console.log(`[ShippingService] Order ${order.orderId} already has Shiprocket Order ID: ${order.shiprocketOrderId}. Skipping creation.`);
        // Ideally we should fetch it to be sure, but for now assume valid if ID exists.
        // We need the shipment_id for the next steps. Use the one from DB if available.
        shiprocketOrder = {
          order_id: order.shiprocketOrderId,
          shipment_id: order.shiprocketShipmentId
        };
      } else {
        const createResponse = await this.createShipment(shiprocketOrderData);
        if (!createResponse || !createResponse.order_id) {
          throw new Error('Failed to create order in Shiprocket - No order_id returned');
        }
        shiprocketOrder = createResponse;

        // Save initial Shiprocket details
        order.shiprocketOrderId = shiprocketOrder.order_id.toString();
        order.shiprocketShipmentId = shiprocketOrder.shipment_id?.toString();
        await order.save();
        console.log(`[ShippingService] Created Shiprocket Order: ${order.shiprocketOrderId}, Shipment: ${order.shiprocketShipmentId}`);
      }

      const shipmentId = shiprocketOrder.shipment_id || order.shiprocketShipmentId;

      if (!shipmentId) {
        throw new Error(`Missing shipment_id for order ${order.orderId}`);
      }

      // 4. Fetch Available Couriers
      // We need pickup and delivery postcodes. 
      // pickup postcode should be fetched from pickup location details ideally, but here we might need to rely on env or hardcoded if not returned in order creation
      // For now, let's assume we can get it or just skip this step if we can't find pickup code. 
      // Actually Shiprocket 'serviceability' API needs pickup_postcode.
      // Let's rely on a default if not known, or try to get it. 
      const pickupPostcode = process.env.SHIPROCKET_PICKUP_PINCODE || '110001'; // Fallback

      console.log(`[ShippingService] Fetching couriers for Shipment: ${shipmentId}, Route: ${pickupPostcode} -> ${shippingAddress.pincode}`);
      const courierResponse = await this.getAvailableCouriers(pickupPostcode, shippingAddress.pincode, 0.3);

      const availableCouriers = courierResponse.data?.available_courier_companies || [];

      if (availableCouriers.length === 0) {
        console.warn(`[ShippingService] No couriers found for order ${order.orderId}. stopping automation here.`);
        return { success: true, warning: 'No courier available', order };
      }

      // 5. Select Best Courier
      // Strategy: Prefer 'Platinum' or 'Gold' plans, or just lowest rate.
      // Shiprocket returns `rate` and `rating` and `etd`.
      // Let's sort by Rate (Cheapest) first.

      // Simple logic: Sort by cost ascending.
      availableCouriers.sort((a, b) => a.rate - b.rate);

      const selectedCourier = availableCouriers[0];
      console.log(`[ShippingService] Selected Courier: ${selectedCourier.courier_name} (ID: ${selectedCourier.courier_company_id}) - Rate: ${selectedCourier.rate}`);

      // 6. Generate AWB
      console.log(`[ShippingService] Generating AWB for Shipment: ${shipmentId} with Courier ID: ${selectedCourier.courier_company_id}`);
      const awbResponse = await this.generateAWB(shipmentId, selectedCourier.courier_company_id);

      if (!awbResponse.response || !awbResponse.response.data || !awbResponse.response.data.awb_assign_status) {
        throw new Error('AWB generation failed or response invalid');
      }

      const awbData = awbResponse.response.data;

      // 7. Update Order with Final Shipment Details
      order.shiprocketAWB = awbData.awb_code;
      order.trackingNumber = awbData.awb_code;
      order.courierName = selectedCourier.courier_name;
      order.courierCompanyId = selectedCourier.courier_company_id;
      order.shippingStatus = 'confirmed'; // Confirmed means AWB assigned/ready to ship

      // Construct tracking URL
      order.trackingUrl = `https://shiprocket.co/tracking/${awbData.awb_code}`;

      await order.save();

      console.log(`[ShippingService] AWB Generated: ${order.shiprocketAWB}. Order Updated.`);

      // Attempt to schedule pickup (Optional - user might want to do this manually)
      // For full automation, we could try:
      // await this.schedulePickup([shipmentId]);

      return { success: true, order, courier: selectedCourier };

    } catch (error) {
      console.error('Error in processShipmentForOrder:', error.message);
      // Don't throw logic errors that would break the checkout flow, just log them.
      // But if it's a critical error (DB connection), maybe throw.
      // For now, return error object so caller knows automation failed.
      return { success: false, error: error.message };
    }
  }
}

module.exports = ShippingService;