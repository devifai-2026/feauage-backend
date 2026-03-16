const axios = require('axios');
const { sendOrderShippedEmail } = require('./mailer');

class ShippingService {
  constructor() {
    this.baseURL = process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external';
    this.token = null;
    this.tokenExpiry = null;
  }

  // Authenticate with Shiprocket
  async authenticate() {
    const email = (process.env.SHIPROCKET_EMAIL || '').trim();
    const password = (process.env.SHIPROCKET_PASSWORD || '').trim();

    if (!email || !password) {
      console.error('[Shiprocket] ❌ Missing credentials — SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD not set in .env');
      throw new Error('Shiprocket credentials not configured');
    }

    try {
      const response = await axios.post(`${this.baseURL}/auth/login`, {
        email,
        password
      });

      this.token = response.data.token;
      this.tokenExpiry = Date.now() + (230 * 60 * 60 * 1000); // 230 hours (token valid 240h)

      console.log(`[Shiprocket] ✅ Authentication successful. Token valid for ~230h.`);
      return this.token;
    } catch (error) {
      const errData = error.response?.data;
      console.error(`[Shiprocket] ❌ Authentication failed`);
      console.error(`[Shiprocket] Error details:`, errData?.message || error.message);
      if (errData?.status_code === 403) {
        console.error('[Shiprocket] 403 = Wrong email/password. Please verify credentials at https://app.shiprocket.in → Account Settings.');
      }
      throw error;
    }
  }

  // Fetch pickup locations from Shiprocket account
  async getPickupLocations() {
    const headers = await this.getHeaders();
    const response = await axios.get(`${this.baseURL}/settings/company/pickup`, { headers });
    // Shiprocket returns data in different shapes — handle all known variants
    const d = response.data;
    return d?.data?.shipping_address
      || d?.data?.pickup_address
      || d?.shipping_address
      || d?.data
      || [];
  }

  // Test Shiprocket connection (call on startup)
  async testConnection() {
    try {
      console.log('[Shiprocket] 🔍 Testing connection...');
      await this.authenticate();
      console.log('[Shiprocket] ✅ Connection test PASSED — Shiprocket is working correctly.');

      // Fetch and log pickup locations so user knows what to set in .env
      try {
        const locations = await this.getPickupLocations();
        if (locations.length > 0) {
          console.log('[Shiprocket] 📍 Available pickup locations in your account:');
          locations.forEach(loc => {
            console.log(`   • pickup_name="${loc.pickup_location}" | ${loc.address}, ${loc.city}, ${loc.state} - ${loc.pin_code}`);
          });
          const configured = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';
          const matched = locations.find(l => l.pickup_location === configured);
          if (!matched) {
            console.warn(`[Shiprocket] ⚠️  SHIPROCKET_PICKUP_LOCATION="${configured}" does NOT match any location above!`);
            console.warn(`[Shiprocket] ⚠️  Set SHIPROCKET_PICKUP_LOCATION to one of the names listed above in your .env`);
          } else {
            console.log(`[Shiprocket] ✅ Pickup location "${configured}" matched successfully.`);
          }
        }
      } catch (locErr) {
        console.warn('[Shiprocket] Could not fetch pickup locations:', locErr.message);
      }

      return true;
    } catch (error) {
      console.error('[Shiprocket] ❌ Connection test FAILED — Shiprocket will NOT work until credentials are fixed.');
      return false;
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

      console.log('[Shiprocket] ✅ Shipment created. Order ID:', response.data?.order_id, 'Shipment ID:', response.data?.shipment_id);
      return response.data;
    } catch (error) {
      console.error('[Shiprocket] ❌ Shipment creation failed. Full error:', JSON.stringify(error.response?.data || error.message));
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

  // Cancel order/shipment by Shiprocket order ID
  async cancelShipment(shiprocketOrderId) {
    try {
      const headers = await this.getHeaders();

      const response = await axios.post(`${this.baseURL}/orders/cancel`, {
        ids: [shiprocketOrderId]
      }, { headers });

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

      const response = await axios.get(`${this.baseURL}/courier/serviceability/`, {
        params: {
          pickup_postcode: pickupPostcode,
          delivery_postcode: deliveryPostcode,
          weight,
          cod: 0,
          ...dimensions
        },
        headers
      });

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

  // Check if delivery is possible to a pincode (pre-payment serviceability check)
  async checkServiceability(deliveryPostcode, weight = 0.3) {
    const pickupPostcode = process.env.SHIPROCKET_PICKUP_PINCODE || '110001';
    try {
      const result = await this.getAvailableCouriers(pickupPostcode, deliveryPostcode, weight);
      const couriers = result.data?.available_courier_companies || [];
      console.log(`[ShippingService] Serviceability ${pickupPostcode} -> ${deliveryPostcode}: ${couriers.length} couriers`);
      return {
        deliverable: couriers.length > 0,
        courierCount: couriers.length,
        pickupPostcode,
        deliveryPostcode
      };
    } catch (error) {
      console.error('[ShippingService] Serviceability check failed:', error.message);
      // Return deliverable=true on API failure so checkout is not blocked
      return { deliverable: true, courierCount: 0, error: error.message };
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

  // Static helper: build Shiprocket order payload from order, items, and shipping address
  static createOrderData(order, orderItems, shippingAddress) {
    const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';

    // Handle name — OrderAddress stores as full 'name', User addresses split into firstName/lastName
    const fullName = shippingAddress.name
      || `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim()
      || 'Customer';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '.';  // Shiprocket requires non-empty last name

    // Address line — OrderAddress uses addressLine1; User model uses 'address' (alias addressLine1)
    const addressLine1 = shippingAddress.addressLine1 || shippingAddress.address || '';
    const addressLine2 = [shippingAddress.addressLine2, shippingAddress.landmark]
      .filter(Boolean)
      .join(', ');

    // Phone must be exactly 10 digits
    const phone = (shippingAddress.phone || '').replace(/\D/g, '').slice(-10);

    // Pincode must be 6 digits
    const pincode = (shippingAddress.pincode || shippingAddress.zipCode || '').replace(/\D/g, '').slice(0, 6);

    // Email fallback to order-level if not on address
    const email = shippingAddress.email || order.email || 'noreply@feauage.com';

    return {
      order_id: order.orderId,
      order_date: new Date(order.createdAt).toISOString().split('T')[0],
      pickup_location: pickupLocation,
      channel_id: '',
      comment: `Order from Feauage Jewelry - ${order.orderId}`,
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: addressLine1,
      billing_address_2: addressLine2,
      billing_city: shippingAddress.city,
      billing_pincode: pincode,
      billing_state: shippingAddress.state,
      billing_country: shippingAddress.country || 'India',
      billing_email: email,
      billing_phone: phone,
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
      weight: 0.3 // Default weight for jewelry (kg)
    };
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

      // 2. Resolve correct pickup location name from Shiprocket account
      let pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';
      try {
        const locations = await this.getPickupLocations();
        if (locations.length > 0) {
          const matched = locations.find(l => l.pickup_location === pickupLocation);
          if (!matched) {
            const firstLocation = locations[0].pickup_location;
            console.warn(`[Shiprocket] ⚠️  Pickup location "${pickupLocation}" not found. Auto-selecting first available: "${firstLocation}"`);
            console.warn(`[Shiprocket] ⚠️  Set SHIPROCKET_PICKUP_LOCATION=${firstLocation} in .env to fix this permanently`);
            pickupLocation = firstLocation;
            // Patch env for this process run so createOrderData picks it up
            process.env.SHIPROCKET_PICKUP_LOCATION = pickupLocation;
          }
        }
      } catch (locErr) {
        console.warn('[Shiprocket] Could not verify pickup location, proceeding with configured value:', locErr.message);
      }

      // 3. Prepare Shiprocket Order Payload
      console.log(`[ShippingService] Creating Shiprocket order for ${order.orderId} from "${pickupLocation}"`);
      const shiprocketOrderData = ShippingService.createOrderData(order, orderItems, shippingAddress);

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
        // Notify admins via socket about the shipping issue
        try {
          const { emitOrderNotification } = require('../sockets/orderSocket');
          emitOrderNotification('shipping_issue', {
            type: 'shipping_issue',
            orderId: order.orderId,
            orderDbId: order._id,
            userId: order.user?.toString(),
            issue: `No couriers available for route ${pickupPostcode} → ${shippingAddress.pincode}`,
            message: `Order ${order.orderId}: No couriers available to ${shippingAddress.city} (${shippingAddress.pincode}). Manual action required.`
          });
        } catch (socketErr) {
          console.warn('[ShippingService] Could not emit shipping_issue socket event:', socketErr.message);
        }
        return { success: false, warning: 'No courier available', order };
      }

      // 5. Select Best Courier
      // Strategy: Prefer 'Platinum' or 'Gold' plans, or just lowest rate.
      // Shiprocket returns `rate` and `rating` and `etd`.
      // Let's sort by Rate (Cheapest) first.

      // Simple logic: Sort by cost ascending.
      availableCouriers.sort((a, b) => a.rate - b.rate);

      // 6. Try couriers in order (cheapest first) until AWB is assigned
      let awbCode = null;
      let selectedCourier = null;
      const awbErrors = [];

      for (const courier of availableCouriers) {
        console.log(`[ShippingService] Trying AWB with courier: ${courier.courier_name} (ID: ${courier.courier_company_id})`);
        try {
          const awbResponse = await this.generateAWB(shipmentId, courier.courier_company_id);

          if (awbResponse.awb_assign_status === 0) {
            const reason = awbResponse.response?.data?.awb_assign_error || 'Unknown reason';

            // Shiprocket already assigned an AWB to this shipment — extract and use it
            const alreadyAssignedMatch = reason.match(/awb\s*-\s*([A-Za-z0-9]+)/i);
            if (alreadyAssignedMatch) {
              const existingAWB = alreadyAssignedMatch[1];
              console.log(`[ShippingService] AWB already assigned: ${existingAWB} — using it`);
              awbCode = existingAWB;
              selectedCourier = courier;
              break;
            }

            console.warn(`[ShippingService] Courier ${courier.courier_name} rejected: ${reason}`);
            awbErrors.push(`${courier.courier_name}: ${reason}`);
            continue;
          }

          const awbData = awbResponse.response?.data || awbResponse;
          if (!awbData.awb_code) {
            console.warn(`[ShippingService] Courier ${courier.courier_name} returned no awb_code`);
            awbErrors.push(`${courier.courier_name}: no awb_code in response`);
            continue;
          }

          awbCode = awbData.awb_code;
          selectedCourier = courier;
          console.log(`[ShippingService] AWB assigned: ${awbCode} via ${courier.courier_name}`);
          break;
        } catch (err) {
          console.warn(`[ShippingService] AWB attempt failed for ${courier.courier_name}:`, err.message);
          awbErrors.push(`${courier.courier_name}: ${err.message}`);
        }
      }

      if (!awbCode) {
        console.error(`[ShippingService] All ${availableCouriers.length} couriers failed AWB assignment:`, awbErrors);
        // Emit shipping issue so admin knows manual action is needed
        try {
          const { emitOrderNotification } = require('../sockets/orderSocket');
          emitOrderNotification('shipping_issue', {
            type: 'shipping_issue',
            orderId: order.orderId,
            orderDbId: order._id,
            userId: order.user?.toString(),
            issue: 'All couriers rejected AWB assignment',
            message: `Order ${order.orderId}: All couriers failed AWB assignment. Errors: ${awbErrors.join('; ')}`
          });
        } catch (socketErr) {
          console.warn('[ShippingService] Could not emit shipping_issue socket event:', socketErr.message);
        }
        return { success: false, warning: 'All couriers rejected AWB assignment', order };
      }

      // 7. Update Order with Final Shipment Details
      order.shiprocketAWB = awbCode;
      order.trackingNumber = awbCode;
      order.courierName = selectedCourier.courier_name;
      order.courierCompanyId = selectedCourier.courier_company_id;
      order.shippingStatus = 'confirmed'; // Confirmed means AWB assigned/ready to ship

      // Construct tracking URL
      order.trackingUrl = `https://shiprocket.co/tracking/${awbCode}`;

      await order.save();

      console.log(`[ShippingService] AWB Generated: ${order.shiprocketAWB}. Order Updated.`);

      // Notify admins via socket about successful shipment
      try {
        const { emitOrderNotification } = require('../sockets/orderSocket');
        emitOrderNotification('shipping_confirmed', {
          type: 'shipping_confirmed',
          orderId: order.orderId,
          orderDbId: order._id,
          userId: order.user?.toString(),
          awb: order.shiprocketAWB,
          courierName: order.courierName,
          message: `Order ${order.orderId}: Shipment confirmed via ${order.courierName}. AWB: ${order.shiprocketAWB}`
        });
      } catch (socketErr) {
        console.warn('[ShippingService] Could not emit shipping_confirmed socket event:', socketErr.message);
      }

      // Send shipped email to customer
      try {
        const User = require('../models/User');
        const user = await User.findById(order.user).select('email firstName');
        if (user && user.email) {
          await sendOrderShippedEmail(user, order, orderItems);
        }
      } catch (emailErr) {
        console.warn('[ShippingService] Could not send shipped email:', emailErr.message);
      }

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