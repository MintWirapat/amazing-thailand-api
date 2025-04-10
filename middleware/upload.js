const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// สร้างโฟลเดอร์สำหรับเก็บไฟล์อัปโหลดถ้ายังไม่มี
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// กำหนดค่าการจัดเก็บไฟล์
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // สร้างชื่อไฟล์ที่ไม่ซ้ำกัน
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const fileExt = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${fileExt}`);
  }
});

// กำหนดชนิดไฟล์ที่อนุญาต
const fileFilter = (req, file, cb) => {
  // อนุญาตเฉพาะไฟล์รูปภาพ
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น'), false);
  }
};

// กำหนดขนาดไฟล์สูงสุด (5MB)
const maxSize = 5 * 1024 * 1024;

// สร้าง multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: maxSize
  }
});

module.exports = upload;