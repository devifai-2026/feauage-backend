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

const { protect, restrictTo, isAdmin } = require("../middleware/auth");
const {
  uploadProductImages: uploadProductImagesMiddleware,
  uploadBannerImage: uploadBannerImageMiddleware,
  uploadCategoryImage: uploadCategoryImageMiddleware,
} = require("../middleware/upload");
const { generatePresignedUrl } = require("../controllers/admin/s3Controller");

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect);
router.use(restrictTo("admin", "superadmin"));

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
  uploadProductImagesMiddleware,
  uploadProductImages
);
router.patch("/products/images/:imageId/set-primary", setPrimaryImage);
router.delete("/products/images/:imageId", deleteProductImage);
router.get("/products/:id/stock-history", getStockHistory);
router.patch("/products/:id/stock", updateStock);
router.route("/products/:id").patch(updateProduct).delete(deleteProduct);

// Category routes
router.get("/categories", getAllCategories);
router.get("/categories/tree", getCategoryTree);
router.post("/categories", createCategory);
router.route("/categories/:id").patch(updateCategory).delete(deleteCategory);

// Subcategory routes
router.get("/subcategories", getSubCategories);
router.post("/subcategories", createSubCategory);
router
  .route("/subcategories/:id")
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

//aws routes
router.post("/s3/presigned-url", generatePresignedUrl);

module.exports = router;
