// routes/admin/userRoutes.js
const express = require("express");
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
  getUserStatistics,
  exportUsers,
  searchUsers,
  bulkUpdateUsers,
  getUserActivity,
} = require("../controllers/admin/adminController");

const { protect, restrictTo } = require("../middleware/auth");

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect);
router.use(restrictTo("admin", "superadmin"));

// User management routes
router.route("/").get(getAllUsers).post(createUser);

router.route("/search").get(searchUsers);

router.route("/stats").get(getUserStatistics);

router.route("/export").get(exportUsers);

router.route("/bulk-update").patch(bulkUpdateUsers);

router.route("/:id").get(getUserById).put(updateUser).delete(deleteUser);

router.route("/:id/status").patch(updateUserStatus);

router.route("/:id/activity").get(getUserActivity);

module.exports = router;