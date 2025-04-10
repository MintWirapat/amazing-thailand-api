const express = require('express');
const router = express.Router();
const provincesController = require('../controllers/provincesController');
const { auth, adminAuth } = require('../middleware/auth');

// GET /api/provinces - ดึงรายการจังหวัดทั้งหมด
router.get('/', provincesController.getAllProvinces);

// GET /api/provinces/:id - ดึงข้อมูลจังหวัดจาก ID
router.get('/:id', provincesController.getProvinceById);

// GET /api/provinces/:id/places - ดึงสถานที่ทั้งหมดในจังหวัด
router.get('/:id/places', provincesController.getProvincePlaces);

// POST /api/provinces - เพิ่มจังหวัดใหม่ (เฉพาะแอดมิน)
router.post('/', auth, adminAuth, provincesController.createProvince);

// PUT /api/provinces/:id - อัพเดตจังหวัด (เฉพาะแอดมิน)
router.put('/:id', auth, adminAuth, provincesController.updateProvince);

// DELETE /api/provinces/:id - ลบจังหวัด (เฉพาะแอดมิน)
router.delete('/:id', auth, adminAuth, provincesController.deleteProvince);

module.exports = router;