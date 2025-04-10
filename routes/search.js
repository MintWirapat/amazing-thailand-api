const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { optionalAuth } = require('../middleware/auth');

// GET /api/search - ค้นหาสถานที่ท่องเที่ยว
router.get('/', optionalAuth, searchController.searchPlaces);

// GET /api/search/suggest - ค้นหาแบบแนะนำ (autocomplete)
router.get('/suggest', searchController.suggestPlaces);

// GET /api/search/nearby - ค้นหาสถานที่ใกล้เคียง
router.get('/nearby', optionalAuth, searchController.searchNearby);

module.exports = router;