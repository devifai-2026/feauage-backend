const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

// Public routes for client application
router.get('/page/:page', bannerController.getBannersByPage);
router.get('/name/:name', bannerController.getBannerByName);
router.get('/active', bannerController.getActiveBanners);

module.exports = router;
