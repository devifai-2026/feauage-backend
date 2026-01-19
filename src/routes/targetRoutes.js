const express = require('express');
const {
  createTarget,
  getAllTargets,
  getTarget,
  updateTarget,
  deleteTarget,
  updateTargetValue,
  getCurrentTarget,
  getTargetStats,
  getMonthlyRevenueProgress,
  archiveTarget,
  bulkArchiveTargets
} = require('../controllers/admin/targetController');

const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// All target routes
router.route('/')
  .get(getAllTargets)
  .post(createTarget);

router.get('/current', getCurrentTarget);
router.get('/stats', getTargetStats);
router.get('/revenue/monthly', getMonthlyRevenueProgress);

router.route('/:id')
  .get(getTarget)
  .patch(updateTarget)
  .delete(deleteTarget);

router.patch('/:id/update-value', updateTargetValue);
router.patch('/:id/archive', archiveTarget);
router.patch('/bulk-archive', bulkArchiveTargets);

module.exports = router;