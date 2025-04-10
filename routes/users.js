const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/users/:username - ดึงข้อมูลโปรไฟล์ผู้ใช้
router.get('/:username', usersController.getUserProfile);

// PUT /api/users/profile - อัพเดตข้อมูลโปรไฟล์ (ต้องล็อกอินแล้ว)
router.put('/profile', auth, usersController.updateProfile);

// PUT /api/users/profile/image - อัพเดตรูปโปรไฟล์ (ต้องล็อกอินแล้ว)
router.put('/profile/image', auth, upload.single('profile_image'), usersController.updateProfileImage);

// PUT /api/users/profile/cover - อัพเดตรูปปกโปรไฟล์ (ต้องล็อกอินแล้ว)
router.put('/profile/cover', auth, upload.single('cover_image'), usersController.updateCoverImage);

// GET /api/users/:username/places - ดึงรายการสถานที่ของผู้ใช้
router.get('/:username/places', usersController.getUserPlaces);

// GET /api/users/favorites - ดึงรายการสถานที่ที่บันทึกไว้ (ต้องล็อกอินแล้ว)
router.get('/favorites', auth, usersController.getFavoritePlaces);

module.exports = router;