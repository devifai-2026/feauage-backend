const express = require('express');
const router = express.Router();
const contactSupportController = require('../controllers/contactSupportController');

// Public routes for client application
router.get('/getAllContactSupport', contactSupportController.getAllContactSupport);
router.post('/createContactSupport', contactSupportController.createContactSupport);
router.patch('/updateContactSupport/:id', contactSupportController.updateContactSupport);

module.exports = router;