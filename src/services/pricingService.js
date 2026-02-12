const { TAX_RATES, SHIPPING } = require('../constants');

/**
 * Pricing Service
 * Handles all pricing calculations for orders
 */
class PricingService {
    /**
     * Calculate tax for given amount
     * @param {Number} amount - Taxable amount
     * @param {Number} rate - Tax rate (default: GST)
     * @returns {Number} Tax amount
     */
    static calculateTax(amount, rate = TAX_RATES.GST) {
        return amount * rate;
    }

    /**
     * Calculate shipping charge based on pincode and order value
     * @param {String} pincode - Delivery pincode
     * @param {Number} orderValue - Total order value
     * @returns {Number} Shipping charge
     */
    static calculateShipping(pincode, orderValue) {
        // Free shipping above threshold
        if (orderValue >= SHIPPING.FREE_THRESHOLD) {
            return 0;
        }

        // Metro cities get lower shipping charge
        const pincodePrefix = pincode.substring(0, 6);
        if (SHIPPING.METRO_PINCODES.includes(pincodePrefix)) {
            return SHIPPING.METRO_CHARGE;
        }

        // Standard charge for other areas
        return SHIPPING.STANDARD_CHARGE;
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
    static calculateOrderTotals(subtotal, discount, pincode) {
        const shippingCharge = this.calculateShipping(pincode, subtotal);
        const taxableAmount = subtotal - discount;
        const tax = this.calculateTax(taxableAmount);
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
