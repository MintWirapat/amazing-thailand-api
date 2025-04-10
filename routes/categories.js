const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categoriesController');
const { auth, adminAuth } = require('../middleware/auth');

// GET /api/categories - ดึงรายการหมวดหมู่ทั้งหมด
router.get('/', categoriesController.getAllCategories);

// GET /api/categories/:id - ดึงข้อมูลหมวดหมู่จาก ID
router.get('/:id', categoriesController.getCategoryById);

// POST /api/categories - เพิ่มหมวดหมู่ใหม่ (เฉพาะแอดมิน)
router.post('/', auth, adminAuth, categoriesController.createCategory);

// PUT /api/categories/:id - อัพเดตหมวดหมู่ (เฉพาะแอดมิน)
router.put('/:id', auth, adminAuth, categoriesController.updateCategory);

// DELETE /api/categories/:id - ลบหมวดหมู่ (เฉพาะแอดมิน)
router.delete('/:id', auth, adminAuth, categoriesController.deleteCategory);

module.exports = router;