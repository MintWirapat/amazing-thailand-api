const jwt = require('jsonwebtoken');
const db = require('../db/db');

// ตรวจสอบและยืนยันตัวตนผู้ใช้ (จำเป็นต้องล็อกอิน)
exports.auth = async (req, res, next) => {
  try {
    // ดึง token จาก header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // ตรวจสอบว่ามี token หรือไม่
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'กรุณาเข้าสู่ระบบ'
      });
    }

    // ตรวจสอบความถูกต้องของ token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // ดึงข้อมูลผู้ใช้ (ไม่รวมรหัสผ่าน)
      const users = await db.query(
        'SELECT user_id, username, email, display_name, is_admin FROM users WHERE user_id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'ไม่พบผู้ใช้นี้ในระบบ'
        });
      }
      console.log('users', users);
      // ตรวจสอบว่า token ตรงกับผู้ใช้หรือไม่
      // เก็บข้อมูลผู้ใช้ใน req.user
      req.user = users[0];
      req.user.id = users[0].user_id ; // เก็บ id ของผู้ใช้ใน req.user.id
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token ไม่ถูกต้องหรือหมดอายุ'
      });
    }
  } catch (error) {
    next(error);
  }
};

// ตรวจสอบตัวตนผู้ใช้แบบไม่บังคับ (ไม่จำเป็นต้องล็อกอิน)
exports.optionalAuth = async (req, res, next) => {
  try {
    // ดึง token จาก header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // ถ้าไม่มี token ให้ผ่านไปเลย
    if (!token) {
      return next();
    }

    // ตรวจสอบความถูกต้องของ token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // ดึงข้อมูลผู้ใช้ (ไม่รวมรหัสผ่าน)
      const users = await db.query(
        'SELECT user_id, username, email, display_name, is_admin FROM users WHERE user_id = ?',
        [decoded.id]
      );

      if (users.length > 0) {
        // เก็บข้อมูลผู้ใช้ใน req.user
        req.user = users[0];
      }

      next();
    } catch (error) {
      // Token ไม่ถูกต้อง แต่ไม่บังคับให้ล็อกอิน
      next();
    }
  } catch (error) {
    next(error);
  }
};

// ตรวจสอบสิทธิ์แอดมิน
exports.adminAuth = (req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({
      success: false,
      message: 'คุณไม่มีสิทธิ์ในการเข้าถึงส่วนนี้'
    });
  }
  next();
};