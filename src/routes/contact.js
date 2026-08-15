const express = require('express');
const router = express.Router();
const contactSupportController = require('../controllers/contactSupportController');
const { protect, restrictTo } = require('../middleware/auth');

// Public — the storefront contact form posts here
router.post('/createContactSupport', contactSupportController.createContactSupport);

// Everything below reads or mutates other people's support submissions,
// so it is admin-only (these were previously unauthenticated).
router.use(protect);
router.use(restrictTo('admin', 'superadmin'));

router.get('/getAllContactSupport', contactSupportController.getAllContactSupport);
router.get('/getContactSupport/:id', contactSupportController.getContactSupport);
router.patch('/updateContactSupport/:id', contactSupportController.updateContactSupport);
router.patch('/markAllAsRead', contactSupportController.markAllAsRead);

module.exports = router;
