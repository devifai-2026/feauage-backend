const express = require('express');
const { getActivePromoCodes, validatePromoCode } = require('../controllers/admin/promoCodeController');

const router = express.Router();

router.get('/', getActivePromoCodes);
router.post('/validate', validatePromoCode);

module.exports = router;
