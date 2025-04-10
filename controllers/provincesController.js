const db = require('../db/db');
const fs = require('fs');
const path = require('path');

// ดึงรายการจังหวัดทั้งหมด
exports.getAllProvinces = async (req, res, next) => {
  try {
    const region = req.query.region;
    
    let query = `
      SELECT p.province_id, p.province_name, p.region, p.description, p.image,
             COUNT(pl.place_id) as place_count
      FROM provinces p
      LEFT JOIN places pl ON p.province_id = pl.province_id AND pl.is_active = TRUE
    `;
    
    const queryParams = [];
    
    if (region) {
      query += ` WHERE p.region = ?`;
      queryParams.push(region);
    }
    
    query += ` GROUP BY p.province_id ORDER BY p.province_name`;

    const provinces = await db.query(query, queryParams);

    res.status(200).json({
      success: true,
      count: provinces.length,
      data: provinces
    });
  } catch (error) {
    next(error);
  }
};

// ดึงข้อมูลจังหวัดจาก ID
exports.getProvinceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const provinces = await db.query(`
      SELECT p.province_id, p.province_name, p.region, p.description, p.image,
             COUNT(pl.place_id) as place_count
      FROM provinces p
      LEFT JOIN places pl ON p.province_id = pl.province_id AND pl.is_active = TRUE
      WHERE p.province_id = ?
      GROUP BY p.province_id
    `, [id]);

    if (provinces.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบจังหวัดนี้'
      });
    }

    res.status(200).json({
      success: true,
      data: provinces[0]
    });
  } catch (error) {
    next(error);
  }
};

// ดึงสถานที่ทั้งหมดในจังหวัด
exports.getProvincePlaces = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const category = req.query.category;

    // ตรวจสอบว่ามีจังหวัดนี้อยู่หรือไม่
    const provinces = await db.query(`
      SELECT * FROM provinces WHERE province_id = ?
    `, [id]);

    if (provinces.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบจังหวัดนี้'
      });
    }

    // สร้าง query สำหรับดึงสถานที่ในจังหวัด
    let query = `
      SELECT p.place_id, p.title, p.description, p.location, p.main_image, p.created_at,
             c.category_name, c.icon as category_icon,
             u.username, u.display_name,
             COUNT(DISTINCT l.like_id) as likes_count,
             COUNT(DISTINCT com.comment_id) as comments_count
      FROM places p
      JOIN categories c ON p.category_id = c.category_id
      JOIN users u ON p.user_id = u.user_id
      LEFT JOIN likes l ON p.place_id = l.place_id
      LEFT JOIN comments com ON p.place_id = com.place_id AND com.is_active = TRUE
      WHERE p.province_id = ? AND p.is_active = TRUE
    `;
    
    const queryParams = [id];
    
    if (category) {
      query += ` AND c.category_name = ?`;
      queryParams.push(category);
    }
    
    query += ` GROUP BY p.place_id ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const places = await db.query(query, queryParams);

    // ดึงจำนวนสถานที่ทั้งหมดในจังหวัด
    let countQuery = `
      SELECT COUNT(*) as total
      FROM places p
      JOIN categories c ON p.category_id = c.category_id
      WHERE p.province_id = ? AND p.is_active = TRUE
    `;
    
    const countParams = [id];
    
    if (category) {
      countQuery += ` AND c.category_name = ?`;
      countParams.push(category);
    }
    
    const countResult = await db.query(countQuery, countParams);
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

// เพิ่มจังหวัดใหม่
exports.createProvince = async (req, res, next) => {
  try {
    const { province_name, region, description } = req.body;
    let image = null;

    // ตรวจสอบว่ามีจังหวัดนี้อยู่แล้วหรือไม่
    const existingProvinces = await db.query(`
      SELECT * FROM provinces WHERE province_name = ?
    `, [province_name]);

    if (existingProvinces.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'มีจังหวัดนี้อยู่แล้ว'
      });
    }

    // ตรวจสอบว่ามีการอัปโหลดรูปภาพหรือไม่
    if (req.file) {
      image = req.file.filename;
    }

    // เพิ่มจังหวัดใหม่
    const result = await db.query(`
      INSERT INTO provinces (province_name, region, description, image)
      VALUES (?, ?, ?, ?)
    `, [province_name, region, description || null, image]);

    res.status(201).json({
      success: true,
      message: 'เพิ่มจังหวัดสำเร็จ',
      data: {
        province_id: result.insertId,
        province_name,
        region,
        description,
        image
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

// อัพเดตจังหวัด
exports.updateProvince = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { province_name, region, description } = req.body;

    // ตรวจสอบว่ามีจังหวัดนี้อยู่หรือไม่
    const provinces = await db.query(`
      SELECT * FROM provinces WHERE province_id = ?
    `, [id]);

    if (provinces.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบจังหวัดนี้'
      });
    }

    // ตรวจสอบว่าชื่อจังหวัดซ้ำหรือไม่
    if (province_name) {
      const existingProvinces = await db.query(`
        SELECT * FROM provinces 
        WHERE province_name = ? AND province_id != ?
      `, [province_name, id]);

      if (existingProvinces.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'มีจังหวัดนี้อยู่แล้ว'
        });
      }
    }

    // อัพเดตรูปภาพ (ถ้ามี)
    let image = null;
    if (req.file) {
      image = req.file.filename;
      
      // ลบรูปเก่า
      if (provinces[0].image) {
        const oldImagePath = path.join(__dirname, '../uploads', provinces[0].image);
        fs.unlink(oldImagePath, err => {
          if (err && err.code !== 'ENOENT') console.error('Error deleting old image:', err);
        });
      }
    }

    // สร้าง query สำหรับอัพเดต
    let query = `
      UPDATE provinces
      SET 
    `;
    
    const updateFields = [];
    const queryParams = [];
    
    if (province_name) {
      updateFields.push(`province_name = ?`);
      queryParams.push(province_name);
    }
    
    if (region) {
      updateFields.push(`region = ?`);
      queryParams.push(region);
    }
    
    if (description !== undefined) {
      updateFields.push(`description = ?`);
      queryParams.push(description);
    }
    
    if (image) {
      updateFields.push(`image = ?`);
      queryParams.push(image);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่มีข้อมูลที่จะอัพเดต'
      });
    }
    
    query += updateFields.join(', ');
    query += ` WHERE province_id = ?`;
    queryParams.push(id);
    
    // อัพเดตจังหวัด
    await db.query(query, queryParams);

    res.status(200).json({
      success: true,
      message: 'อัพเดตจังหวัดสำเร็จ'
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

// ลบจังหวัด
exports.deleteProvince = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่ามีจังหวัดนี้อยู่หรือไม่
    const provinces = await db.query(`
      SELECT * FROM provinces WHERE province_id = ?
    `, [id]);

    if (provinces.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบจังหวัดนี้'
      });
    }

    // ตรวจสอบว่ามีสถานที่ที่อยู่ในจังหวัดนี้หรือไม่
    const places = await db.query(`
      SELECT COUNT(*) as count FROM places WHERE province_id = ?
    `, [id]);

    if (places[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถลบจังหวัดนี้ได้เนื่องจากมีสถานที่ที่อยู่ในจังหวัดนี้'
      });
    }

    // ลบรูปภาพ (ถ้ามี)
    if (provinces[0].image) {
      const imagePath = path.join(__dirname, '../uploads', provinces[0].image);
      fs.unlink(imagePath, err => {
        if (err && err.code !== 'ENOENT') console.error('Error deleting image:', err);
      });
    }

    // ลบจังหวัด
    await db.query(`
      DELETE FROM provinces WHERE province_id = ?
    `, [id]);

    res.status(200).json({
      success: true,
      message: 'ลบจังหวัดสำเร็จ'
    });
  } catch (error) {
    next(error);
  }
};