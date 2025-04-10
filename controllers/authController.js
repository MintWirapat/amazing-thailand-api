const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/db');

// Register a new user
exports.register = async (req, res, next) => {
  const { username, email, password, display_name } = req.body;

  try {
    // Check if username or email already exists
    const existingUser = await db.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
    const result = await db.query(
      'INSERT INTO users (username, email, password, display_name) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, display_name || username]
    );

    // Generate JWT token
    const token = jwt.sign(
      { id: result.insertId, username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'ลงทะเบียนสำเร็จ',
      token,
      user: {
        id: result.insertId,
        username,
        email,
        display_name: display_name || username
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login user
exports.login = async (req, res, next) => {
  const { username, password } = req.body;
  console.log('Login attempt with username:', username);
  console.log('Login attempt with password:', password); // Don't log passwords in production
  // Validate input
  try {
    // Check if user exists
    const users = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'username หรือรหัสผ่านไม่ถูกต้อง'
      });
    }

    const user = users[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
      });
    }

    // Update last login time
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE user_id = ?',
      [user.user_id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { id: user.user_id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        profile_image: user.profile_image
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
exports.getMe = async (req, res, next) => {
  console.log('Fetching user profile for user ID:', req.user.id);
  // Validate input
  try {
    const user = await db.query(
      'SELECT user_id, username, email, display_name, bio, profile_image, cover_image, created_at FROM users WHERE user_id = ?',
      [req.user.id]
    );

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ใช้'
      });
    }

    res.status(200).json({
      success: true,
      data: user[0]
    });
  } catch (error) {
    next(error);
  }
};

// ลืมรหัสผ่าน (ส่งอีเมล)
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    // ตรวจสอบว่ามีอีเมลนี้ในระบบหรือไม่
    const users = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบอีเมลนี้ในระบบ'
      });
    }

    // ในโปรเจกต์จริง จะต้องมีการสร้าง reset token และส่งอีเมล
    // แต่ในตัวอย่างนี้จะเป็นแค่ mock response

    res.status(200).json({
      success: true,
      message: 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว'
    });
  } catch (error) {
    next(error);
  }
};

// เปลี่ยนรหัสผ่าน
exports.changePassword = async (req, res, next) => {
  const { current_password, new_password } = req.body;

  try {
    // ดึงข้อมูลผู้ใช้
    const users = await db.query(
      'SELECT * FROM users WHERE user_id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ใช้'
      });
    }

    const user = users[0];

    // ตรวจสอบรหัสผ่านปัจจุบัน
    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง'
      });
    }

    // เข้ารหัสรหัสผ่านใหม่
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // อัพเดตรหัสผ่าน
    await db.query(
      'UPDATE users SET password = ? WHERE user_id = ?',
      [hashedPassword, req.user.id]
    );

    res.status(200).json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จ'
    });
  } catch (error) {
    next(error);
  }
};