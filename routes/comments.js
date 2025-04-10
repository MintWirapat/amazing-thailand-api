const express = require('express');
const router = express.Router();
const commentsController = require('../controllers/commentsController');
const { auth } = require('../middleware/auth');

// POST /api/comments - เพิ่มความคิดเห็นใหม่ (ต้องล็อกอินแล้ว)
router.post('/', auth, commentsController.addComment);

// PUT /api/comments/:comment_id - แก้ไขความคิดเห็น (ต้องล็อกอินและเป็นเจ้าของ)
router.put('/:comment_id', auth, commentsController.updateComment);

// DELETE /api/comments/:comment_id - ลบความคิดเห็น (ต้องล็อกอินและเป็นเจ้าของ)
router.delete('/:comment_id', auth, commentsController.deleteComment);

// GET /api/comments/place/:place_id - ดึงความคิดเห็นทั้งหมดของสถานที่
router.get('/place/:place_id', commentsController.getPlaceComments);

// GET /api/comments/user - ดึงความคิดเห็นทั้งหมดของผู้ใช้ปัจจุบัน (ต้องล็อกอินแล้ว)
router.get('/user', auth, commentsController.getUserComments);

module.exports = router;
