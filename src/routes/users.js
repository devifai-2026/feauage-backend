const express = require('express');
const {
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
  setDefaultAddress,
  getUserOrders,
  getUserReviews,
  updateProfileImage,
  getUserDashboardStats
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { uploadProfileImage } = require('../middleware/upload');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Address routes
router.get('/addresses', getUserAddresses);
router.post('/addresses', addUserAddress);
router.patch('/addresses/:addressId', updateUserAddress);
router.post('/addresses/:addressId', updateUserAddress);
router.delete('/addresses/:addressId', deleteUserAddress);
router.patch('/addresses/:addressId/set-default', setDefaultAddress);
router.post('/addresses/:addressId/set-default', setDefaultAddress);

// Order routes
router.get('/orders', getUserOrders);

// Review routes
router.get('/reviews', getUserReviews);

// Profile routes
router.patch('/profile-image', uploadProfileImage, updateProfileImage);

// Dashboard routes
router.get('/dashboard/stats', getUserDashboardStats);

module.exports = router;