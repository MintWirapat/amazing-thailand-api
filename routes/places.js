const express = require('express');
const router = express.Router();
const placesController = require('../controllers/placesController');
const { auth, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/places - ดึงรายการสถานที่ท่องเที่ยวทั้งหมด
router.get('/', optionalAuth, placesController.getAllPlaces);

// GET /api/places/:id - ดึงข้อมูลสถานที่ท่องเที่ยวจาก ID
router.get('/:id', optionalAuth, placesController.getPlaceById);

// POST /api/places - สร้างสถานที่ท่องเที่ยวใหม่ (ต้องล็อกอินแล้ว)
router.post('/', 
  auth, 
  upload.fields([
    { name: 'main_image', maxCount: 1 },
    { name: 'gallery', maxCount: 5 }
  ]), 
  placesController.createPlace
);

// PUT /api/places/:id - อัพเดตสถานที่ท่องเที่ยว (ต้องล็อกอินและเป็นเจ้าของ)
router.put('/:id', 
  auth, 
  upload.fields([
    { name: 'main_image', maxCount: 1 },
    { name: 'gallery', maxCount: 5 }
  ]), 
  placesController.updatePlace
);

// DELETE /api/places/:id - ลบสถานที่ท่องเที่ยว (ต้องล็อกอินและเป็นเจ้าของ)
router.delete('/:id', auth, placesController.deletePlace);

// POST /api/places/:id/like - กดไลค์/ยกเลิกการไลค์สถานที่ (ต้องล็อกอินแล้ว)
router.post('/:id/like', auth, placesController.toggleLike);

// POST /api/places/:id/favorite - บันทึก/ยกเลิกการบันทึกสถานที่ (ต้องล็อกอินแล้ว)
router.post('/:id/favorite', auth, placesController.toggleFavorite);

// GET /api/places/popular - ดึงสถานที่ท่องเที่ยวยอดนิยม
router.get('/popular', optionalAuth, placesController.getPopularPlaces);

// GET /api/places/nearby - ดึงสถานที่ท่องเที่ยวใกล้เคียง
router.get('/nearby', optionalAuth, placesController.getNearbyPlaces);

module.exports = router;
