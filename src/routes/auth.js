const express = require('express');
const {
  register,
  login,
  logout,
  getMe,
  updateMe,
  updatePassword,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  verifyEmail,
  resendVerification,
  refreshToken
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);

router.post('/send-register-otp', require('../controllers/authController').sendRegisterOtp);
router.post('/verify-otp', require('../controllers/authController').verifyOtp);

// Protected routes
router.use(protect);
router.post('/logout', logout);
router.get('/me', getMe);
router.patch('/update-me', updateMe);
router.post('/update-me', updateMe);
router.patch('/update-password', updatePassword);
router.post('/update-password', updatePassword);
router.post('/refresh-token', refreshToken);

module.exports = router;