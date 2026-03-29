const { TAX_RATES, SHIPPING } = require('../constants');
const Settings = require('../models/Settings');

/**
 * Pricing Service
 * Handles all pricing calculations for orders
 */
class PricingService {
    /**
     * Calculate tax for given amount using dynamic settings
     * @param {Number} amount - Taxable amount
     * @param {Number} rate - Tax rate (optional override)
     * @returns {Promise<Number>} Tax amount
     */
    static async calculateTax(amount, rate) {
        if (rate !== undefined) {
            return amount * rate;
        }
        const settings = await Settings.getSettings();
        return amount * settings.gstRate;
    }

    /**
     * Calculate shipping charge based on pincode and order value using dynamic settings
     * @param {String} pincode - Delivery pincode
     * @param {Number} orderValue - Total order value
     * @returns {Promise<Number>} Shipping charge
     */
    static async calculateShipping(pincode, orderValue) {
        const settings = await Settings.getSettings();

        // Free shipping above threshold
        if (orderValue >= settings.freeShippingThreshold) {
            return 0;
        }

        // Metro cities get lower shipping charge
        const pincodePrefix = pincode.substring(0, 6);
        if (settings.metroPincodes.includes(pincodePrefix)) {
            return settings.metroShippingCharge;
        }

        // Standard charge for other areas
        return settings.standardShippingCharge;
    }

    /**
     * Apply discount from coupon
     * @param {Number} total - Order total
     * @param {Object} coupon - Coupon object
     * @returns {Number} Discount amount
     */
    static applyDiscount(total, coupon) {
        if (!coupon || !coupon.isValid) {
            return 0;
        }

        if (coupon.discountType === 'percentage') {
            const discount = (total * coupon.discountValue) / 100;
            return Math.min(discount, coupon.maxDiscount || Infinity);
        }

        if (coupon.discountType === 'fixed') {
            return Math.min(coupon.discountValue, total);
        }

        return 0;
    }

    /**
     * Calculate order totals
     * @param {Number} subtotal - Cart subtotal
     * @param {Number} discount - Discount amount
     * @param {String} pincode - Delivery pincode
     * @returns {Object} Order totals breakdown
     */
    static async calculateOrderTotals(subtotal, discount, pincode) {
        const shippingCharge = await this.calculateShipping(pincode, subtotal);
        const taxableAmount = subtotal - discount;
        const tax = await this.calculateTax(taxableAmount);
        const grandTotal = subtotal - discount + shippingCharge + tax;

        return {
            subtotal,
            discount,
            shippingCharge,
            tax,
            taxableAmount,
            grandTotal,
        };
    }

    /**
     * Calculate product price (with offer if applicable)
     * @param {Object} product - Product object
     * @returns {Number} Final price
     */
    static getProductPrice(product) {
        if (product.isOnOffer && product.offerPrice) {
            return product.offerPrice;
        }
        return product.sellingPrice || product.basePrice;
    }

    /**
     * Calculate savings
     * @param {Number} originalPrice - Original price
     * @param {Number} finalPrice - Final price after discounts
     * @returns {Object} Savings breakdown
     */
    static calculateSavings(originalPrice, finalPrice) {
        const savings = originalPrice - finalPrice;
        const savingsPercentage = (savings / originalPrice) * 100;

        return {
            savings,
            savingsPercentage: Math.round(savingsPercentage * 100) / 100,
        };
    }
}

module.exports = PricingService;
