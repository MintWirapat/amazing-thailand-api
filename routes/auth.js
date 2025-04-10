const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// POST /api/auth/register - สมัครสมาชิกใหม่
router.post('/register', authController.register);

// POST /api/auth/login - เข้าสู่ระบบ
router.post('/login', authController.login);

// GET /api/auth/me - ดึงข้อมูลผู้ใช้ปัจจุบัน (ต้องล็อกอินแล้ว)
router.get('/me', auth, authController.getMe);

// POST /api/auth/forgot-password - ลืมรหัสผ่าน
router.post('/forgot-password', authController.forgotPassword);

// PUT /api/auth/change-password - เปลี่ยนรหัสผ่าน (ต้องล็อกอินแล้ว)
router.put('/change-password', auth, authController.changePassword);

module.exports = router;