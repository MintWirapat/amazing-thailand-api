const db = require('../db/db');
const fs = require('fs');
const path = require('path');

// ดึงข้อมูลโปรไฟล์ผู้ใช้จากชื่อผู้ใช้
exports.getUserProfile = async (req, res, next) => {
  try {
    const { username } = req.params;

    // ดึงข้อมูลผู้ใช้ (ไม่รวมรหัสผ่าน)
    const users = await db.query(`
      SELECT user_id, username, display_name, bio, profile_image, cover_image, created_at
      FROM users 
      WHERE username = ?
    `, [username]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ใช้นี้'
      });
    }

    const user = users[0];

    // ดึงจำนวนสถานที่ที่ผู้ใช้โพสต์
    const placesCount = await db.query(`
      SELECT COUNT(*) as count
      FROM places
      WHERE user_id = ?
    `, [user.user_id]);

    // ดึงจำนวนไลค์ที่ได้รับ
    const likesCount = await db.query(`
      SELECT COUNT(*) as count
      FROM likes l
      JOIN places p ON l.place_id = p.place_id
      WHERE p.user_id = ?
    `, [user.user_id]);

    // ดึงจำนวนผู้ติดตาม (ถ้ามีฟีเจอร์นี้)
    // const followersCount = await db.query(`
    //   SELECT COUNT(*) as count
    //   FROM followers
    //   WHERE followed_id = ?
    // `, [user.user_id]);

    res.status(200).json({
      success: true,
      data: {
        ...user,
        stats: {
          places: placesCount[0].count,
          likes_received: likesCount[0].count,
          // followers: followersCount[0].count
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// อัพเดตข้อมูลโปรไฟล์
exports.updateProfile = async (req, res, next) => {
  try {
    const { display_name, bio } = req.body;
    const userId = req.user.id;

    // อัพเดตข้อมูลโปรไฟล์
    await db.query(`
      UPDATE users
      SET display_name = ?, bio = ?
      WHERE user_id = ?
    `, [display_name, bio || null, userId]);

    res.status(200).json({
      success: true,
      message: 'อัพเดตโปรไฟล์สำเร็จ',
      data: {
        display_name,
        bio
      }
    });
  } catch (error) {
    next(error);
  }
};

// อัพเดตรูปโปรไฟล์
exports.updateProfileImage = async (req, res, next) => {
  try {
    // ตรวจสอบว่ามีการอัปโหลดไฟล์หรือไม่
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาอัปโหลดรูปโปรไฟล์'
      });
    }

    const userId = req.user.id;
    const profileImageFile = req.file.filename;

    // ดึงข้อมูลรูปโปรไฟล์เดิม
    const users = await db.query(`
      SELECT profile_image FROM users WHERE user_id = ?
    `, [userId]);

    const oldProfileImage = users[0].profile_image;

    // อัพเดตรูปโปรไฟล์
    await db.query(`
      UPDATE users
      SET profile_image = ?
      WHERE user_id = ?
    `, [profileImageFile, userId]);

    // ลบรูปเก่า (ถ้ามี)
    if (oldProfileImage) {
      const oldImagePath = path.join(__dirname, '../uploads', oldProfileImage);
      fs.unlink(oldImagePath, err => {
        if (err && err.code !== 'ENOENT') console.error('Error deleting old profile image:', err);
      });
    }

    res.status(200).json({
      success: true,
      message: 'อัพเดตรูปโปรไฟล์สำเร็จ',
      data: {
        profile_image: profileImageFile
      }
    });
  } catch (error) {
    // ลบไฟล์ที่อัปโหลดในกรณีที่เกิดข้อผิดพลาด
    if (req.file) {
      fs.unlink(path.join(__dirname, '../uploads', req.file.filename), err => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    next(error);
  }
};

// อัพเดตรูปปกโปรไฟล์
exports.updateCoverImage = async (req, res, next) => {
  try {
    // ตรวจสอบว่ามีการอัปโหลดไฟล์หรือไม่
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาอัปโหลดรูปปกโปรไฟล์'
      });
    }

    const userId = req.user.id;
    const coverImageFile = req.file.filename;

    // ดึงข้อมูลรูปปกเดิม
    const users = await db.query(`
      SELECT cover_image FROM users WHERE user_id = ?
    `, [userId]);

    const oldCoverImage = users[0].cover_image;

    // อัพเดตรูปปก
    await db.query(`
      UPDATE users
      SET cover_image = ?
      WHERE user_id = ?
    `, [coverImageFile, userId]);

    // ลบรูปเก่า (ถ้ามี)
    if (oldCoverImage) {
      const oldImagePath = path.join(__dirname, '../uploads', oldCoverImage);
      fs.unlink(oldImagePath, err => {
        if (err && err.code !== 'ENOENT') console.error('Error deleting old cover image:', err);
      });
    }

    res.status(200).json({
      success: true,
      message: 'อัพเดตรูปปกโปรไฟล์สำเร็จ',
      data: {
        cover_image: coverImageFile
      }
    });
  } catch (error) {
    // ลบไฟล์ที่อัปโหลดในกรณีที่เกิดข้อผิดพลาด
    if (req.file) {
      fs.unlink(path.join(__dirname, '../uploads', req.file.filename), err => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    next(error);
  }
};

// ดึงรายการสถานที่ท่องเที่ยวของผู้ใช้
exports.getUserPlaces = async (req, res, next) => {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // ดึงข้อมูล user_id จากชื่อผู้ใช้
    const users = await db.query(`
      SELECT user_id FROM users WHERE username = ?
    `, [username]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ใช้นี้'
      });
    }

    const userId = users[0].user_id;

    // ดึงรายการสถานที่ของผู้ใช้
    const places = await db.query(`
      SELECT p.place_id, p.title, p.main_image, p.location, p.created_at,
             c.category_name, pr.province_name,
             COUNT(DISTINCT l.like_id) as likes_count,
             COUNT(DISTINCT com.comment_id) as comments_count
      FROM places p
      JOIN categories c ON p.category_id = c.category_id
      JOIN provinces pr ON p.province_id = pr.province_id
      LEFT JOIN likes l ON p.place_id = l.place_id
      LEFT JOIN comments com ON p.place_id = com.place_id AND com.is_active = TRUE
      WHERE p.user_id = ? AND p.is_active = TRUE
      GROUP BY p.place_id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    // ดึงจำนวนสถานที่ทั้งหมดของผู้ใช้
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM places
      WHERE user_id = ? AND is_active = TRUE
    `, [userId]);
    
    const total = countResult[0].total;

    res.status(200).json({
      success: true,
      count: places.length,
      total,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        per_page: limit
      },
      data: places
    });
  } catch (error) {
    next(error);
  }
};

// ดึงรายการสถานที่ที่ผู้ใช้บันทึกไว้
exports.getFavoritePlaces = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // ดึงรายการสถานที่ที่บันทึกไว้
    const places = await db.query(`
      SELECT p.place_id, p.title, p.main_image, p.location, p.created_at,
             c.category_name, pr.province_name, u.username, u.display_name,
             COUNT(DISTINCT l.like_id) as likes_count,
             COUNT(DISTINCT com.comment_id) as comments_count,
             uf.created_at as favorited_at
      FROM user_favorites uf
      JOIN places p ON uf.place_id = p.place_id
      JOIN users u ON p.user_id = u.user_id
      JOIN categories c ON p.category_id = c.category_id
      JOIN provinces pr ON p.province_id = pr.province_id
      LEFT JOIN likes l ON p.place_id = l.place_id
      LEFT JOIN comments com ON p.place_id = com.place_id AND com.is_active = TRUE
      WHERE uf.user_id = ? AND p.is_active = TRUE
      GROUP BY p.place_id
      ORDER BY uf.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    // ดึงจำนวนสถานที่ที่บันทึกไว้ทั้งหมด
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM user_favorites uf
      JOIN places p ON uf.place_id = p.place_id
      WHERE uf.user_id = ? AND p.is_active = TRUE
    `, [userId]);
    
    const total = countResult[0].total;

    res.status(200).json({
      success: true,
      count: places.length,
      total,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        per_page: limit
      },
      data: places
    });
  } catch (error) {
    next(error);
  }
};