const express = require("express");
const {
  getDashboardStats,
  getAdminActivities,
  getSystemHealth,
  getUserStatistics,
  exportData,
  getRevenueOverview,
  getRevenueBreakdown,
  getUserGrowthProgress,
  setMonthlyTarget,
  getMonthlyTarget,
  getRecentOrders,
  getRecentUsers,
  getPerformanceMetrics,
} = require("../controllers/admin/adminController");

const {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getStockHistory,
  updateStock,
  getLowStockProducts,
  getOutOfStockProducts,
  bulkUpdateProducts,
  uploadProductImages,
  setPrimaryImage,
  deleteProductImage,
} = require("../controllers/admin/productController");

const {
  getAllCategories,
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubCategories,
  getSubCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
} = require("../controllers/admin/categoryController");

const {
  getAllOrders,
  getOrder,
  updateOrderStatus,
  updateShippingStatus,
  updatePaymentStatus,
  getOrderStatistics,
  createManualOrder,
  exportOrders,
  getRecentActivities,
  searchOrders,
  getOrdersByStatusCount,
  bulkUpdateOrders,
  getOrderTimeline,
  generateInvoice,
  sendInvoiceEmail,
  // Shiprocket integration
  createShipment,
  getAvailableCouriers,
  generateAWB,
  schedulePickup,
  trackShipment,
  cancelShipment,
  printShippingLabel,
  getShippingChargesEstimate,
  generateManifest,
  retryShipment,
} = require("../controllers/admin/orderController");

const {
  getAllCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  getCouponUsage,
} = require("../controllers/admin/couponController");

const {
  getAllBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner,
  uploadBannerImage,
  getBannersByPage,
} = require("../controllers/admin/bannerController");

const {
  getStockHistory: getAdminStockHistory,
  getStockStatistics,
  bulkUpdateStock,
  getStockAlerts,
  exportStockReport,
} = require("../controllers/admin/stockController");

const {
  getNotifications,
  getUnreadCount,
  getRecentNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getNotification,
} = require("../controllers/admin/notificationController");

const {
  getProfile,
  updateProfile,
  updatePassword,
  uploadProfileImage,
  deleteProfileImage,
  getActivityLog,
} = require("../controllers/admin/profileController");

const {
  getAllReviews,
  updateReviewStatus,
  deleteReview: deleteAdminReview,
} = require("../controllers/admin/reviewController");

const {
  getAllPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  getActivePromoCodes,
} = require("../controllers/admin/promoCodeController");

const {
  getSettings,
  updateSettings,
} = require("../controllers/admin/settingsController");

const {
  getAllUpdates,
  getUpdate,
  createUpdate,
  updateUpdate,
  deleteUpdate,
} = require("../controllers/admin/updateController");

const {
  getAllFlashSales,
  getFlashSale,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
} = require("../controllers/admin/flashSaleController");

const {
  getConfig: getBestSellerConfig,
  updateConfig: updateBestSellerConfig,
} = require("../controllers/admin/bestSellerController");

const {
  getConfig: getFeaturedConfig,
  updateConfig: updateFeaturedConfig,
} = require("../controllers/admin/featuredController");

const {
  getAllTickets,
  getTicket,
  updateTicket,
} = require("../controllers/admin/supportController");

const { protect, restrictTo, isAdmin } = require("../middleware/auth");
const {
  uploadProductImages: uploadProductImagesMiddleware,
  uploadBannerImage: uploadBannerImageMiddleware,
  uploadCategoryImage: uploadCategoryImageMiddleware,
  uploadGenericSingle,
  uploadGenericMultiple,
  requireStorageConfigured,
} = require("../middleware/upload");
const { uploadImage, uploadImages } = require("../controllers/admin/s3Controller");

const router = express.Router();

// All admin routes require authentication and admin role.
// (The storefront reads categories from the public GET /api/v1/categories,
// so this no longer needs a public escape hatch above the guard.)
router.use(protect);
router.use(restrictTo("admin", "superadmin"));

router.get("/categories", getAllCategories);

// Dashboard routes
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/revenue-overview", getRevenueOverview);
router.get("/dashboard/user-growth-progress", getUserGrowthProgress);
router.get("/dashboard/monthly-target", getMonthlyTarget);
router.post("/dashboard/set-target", setMonthlyTarget);
router.get("/dashboard/recent-orders", getRecentOrders);
router.get("/dashboard/recent-users", getRecentUsers);
router.get("/dashboard/performance-metrics", getPerformanceMetrics);
router.get("/activities", getAdminActivities);
router.get("/health", getSystemHealth);
router.get("/users/stats", getUserStatistics);
router.post("/export", exportData);

// Product routes
router.get("/products", getAllProducts);
router.post("/products", createProduct);
router.get("/products/low-stock", getLowStockProducts);
router.get("/products/out-of-stock", getOutOfStockProducts);
router.post("/products/bulk-update", bulkUpdateProducts);
router.post(
  "/products/:id/images",
  requireStorageConfigured,
  uploadProductImagesMiddleware,
  uploadProductImages
);
router.patch("/products/images/:imageId/set-primary", setPrimaryImage);
router.delete("/products/images/:imageId", deleteProductImage);
router.get("/products/:id/stock-history", getStockHistory);
router.patch("/products/:id/stock", updateStock);
router.route("/products/:id").get(getProduct).patch(updateProduct).delete(deleteProduct);

// Category routes

router.get("/categories/tree", getCategoryTree);
router.post("/categories", createCategory);
router.route("/categories/:id").patch(updateCategory).delete(deleteCategory);

// Subcategory routes
router.get("/subcategories", getSubCategories);
router.post("/subcategories", createSubCategory);
router
  .route("/subcategories/:id")
  .get(getSubCategory)
  .patch(updateSubCategory)
  .delete(deleteSubCategory);

// Order routes
router.get("/orders", getAllOrders);
router.get("/orders/statistics", getOrderStatistics);
router.post("/orders/manual", createManualOrder);
router.get("/orders/export", exportOrders);
router.get("/orders/recent-activities", getRecentActivities); // Added
router.get("/orders/search", searchOrders); // Added
router.get("/orders/status-count", getOrdersByStatusCount); // Added
router.post("/orders/bulk-update", bulkUpdateOrders); // Added

router.get("/orders/:id", getOrder);
router.get("/orders/:id/timeline", getOrderTimeline); // Added
router.get("/orders/:id/invoice", generateInvoice); // Added
router.post("/orders/:id/send-invoice", sendInvoiceEmail); // Added
router.patch("/orders/:id/status", updateOrderStatus);
router.patch("/orders/:id/shipping-status", updateShippingStatus);
router.patch("/orders/:id/payment-status", updatePaymentStatus);

// Shiprocket integration routes
router.post("/orders/:id/create-shipment", createShipment);
router.get("/orders/:id/available-couriers", getAvailableCouriers);
router.post("/orders/:id/generate-awb", generateAWB);
router.post("/orders/:id/schedule-pickup", schedulePickup);
router.get("/orders/:id/track-shipment", trackShipment);
router.post("/orders/:id/cancel-shipment", cancelShipment);
router.post("/orders/:id/retry-shipment", retryShipment);
router.get("/orders/:id/shipping-label", printShippingLabel);
router.post("/orders/:id/shipping-charges", getShippingChargesEstimate);
router.post("/orders/generate-manifest", generateManifest);

// Coupon routes
router.get("/coupons", getAllCoupons);
router.post("/coupons/validate", validateCoupon);
router.post("/coupons", createCoupon);
router.get("/coupons/:id/usage", getCouponUsage);
router
  .route("/coupons/:id")
  .get(getCoupon)
  .patch(updateCoupon)
  .delete(deleteCoupon);

// Banner routes
router.get("/banners", getAllBanners);
router.get("/banners/page/:page", getBannersByPage);
router.post("/banners", createBanner);
router.post(
  "/banners/:id/upload-image",
  requireStorageConfigured,
  uploadBannerImageMiddleware,
  uploadBannerImage
);
router
  .route("/banners/:id")
  .get(getBanner)
  .patch(updateBanner)
  .delete(deleteBanner);

// Stock routes
router.get("/stock/history", getAdminStockHistory);
router.get("/stock/statistics", getStockStatistics);
router.post("/stock/bulk-update", bulkUpdateStock);
router.get("/stock/alerts", getStockAlerts);
router.get("/stock/export", exportStockReport);



// Notification routes
router.get("/notifications", getNotifications);
router.get("/notifications/unread-count", getUnreadCount);
router.get("/notifications/recent", getRecentNotifications);
router.patch("/notifications/mark-all-read", markAllAsRead);
router.delete("/notifications/clear-all", clearAllNotifications);
router.get("/notifications/:id", getNotification);
router.patch("/notifications/:id/read", markAsRead);
router.delete("/notifications/:id", deleteNotification);

// Profile routes
router.get("/profile", getProfile);
router.patch("/profile", updateProfile);
router.patch("/profile/password", updatePassword);
router.post("/profile/image", uploadProfileImage);
router.delete("/profile/image", deleteProfileImage);
router.get("/profile/activity", getActivityLog);

// Upload routes (S3)
router.post("/upload", requireStorageConfigured, uploadGenericSingle, uploadImage);
router.post("/upload-multiple", requireStorageConfigured, uploadGenericMultiple, uploadImages);

// Review management
// Review management
router.get("/reviews", getAllReviews);
router.patch("/reviews/:id/status", updateReviewStatus);
router.delete("/reviews/:id", deleteAdminReview);

// Promo code routes
router.get("/promo-codes", getAllPromoCodes);
router.post("/promo-codes", createPromoCode);
router.patch("/promo-codes/:id", updatePromoCode);
router.delete("/promo-codes/:id", deletePromoCode);
router.get("/public/promo-codes", getActivePromoCodes); // Public exposed via admin router but actually used by client if needed, or I'll move it.

// Settings routes
router.get("/settings", getSettings);
router.patch("/settings", updateSettings);

// Flash Sale routes
router.get("/flash-sales", getAllFlashSales);
router.post("/flash-sales", createFlashSale);
router
  .route("/flash-sales/:id")
  .get(getFlashSale)
  .patch(updateFlashSale)
  .delete(deleteFlashSale);

// Best Seller Section routes
router.get("/best-sellers-config", getBestSellerConfig);
router.patch("/best-sellers-config", updateBestSellerConfig);

// Featured Section routes
router.get("/featured-config", getFeaturedConfig);
router.patch("/featured-config", updateFeaturedConfig);

// Support Ticket routes
router.get("/support-tickets", getAllTickets);
router.get("/support-tickets/:id", getTicket);
router.patch("/support-tickets/:id", updateTicket);

// Update (Latest Updates / Articles) routes
router.get("/updates", getAllUpdates);
router.post("/updates", createUpdate);
router
  .route("/updates/:id")
  .get(getUpdate)
  .patch(updateUpdate)
  .delete(deleteUpdate);

module.exports = router;
