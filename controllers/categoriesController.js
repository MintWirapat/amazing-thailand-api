const db = require('../db/db');

// ดึงรายการหมวดหมู่ทั้งหมด
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await db.query(`
      SELECT c.category_id, c.category_name, c.description, c.icon,
             COUNT(p.place_id) as place_count
      FROM categories c
      LEFT JOIN places p ON c.category_id = p.category_id AND p.is_active = TRUE
      GROUP BY c.category_id
      ORDER BY c.category_name
    `);

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// ดึงข้อมูลหมวดหมู่จาก ID
exports.getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const categories = await db.query(`
      SELECT c.category_id, c.category_name, c.description, c.icon,
             COUNT(p.place_id) as place_count
      FROM categories c
      LEFT JOIN places p ON c.category_id = p.category_id AND p.is_active = TRUE
      WHERE c.category_id = ?
      GROUP BY c.category_id
    `, [id]);

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบหมวดหมู่นี้'
      });
    }

    res.status(200).json({
      success: true,
      data: categories[0]
    });
  } catch (error) {
    next(error);
  }
};

// เพิ่มหมวดหมู่ใหม่
exports.createCategory = async (req, res, next) => {
  try {
    const { category_name, description, icon } = req.body;

    // ตรวจสอบว่ามีหมวดหมู่นี้อยู่แล้วหรือไม่
    const existingCategories = await db.query(`
      SELECT * FROM categories WHERE category_name = ?
    `, [category_name]);

    if (existingCategories.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'มีหมวดหมู่นี้อยู่แล้ว'
      });
    }

    // เพิ่มหมวดหมู่ใหม่
    const result = await db.query(`
      INSERT INTO categories (category_name, description, icon)
      VALUES (?, ?, ?)
    `, [category_name, description || null, icon || null]);

    res.status(201).json({
      success: true,
      message: 'เพิ่มหมวดหมู่สำเร็จ',
      data: {
        category_id: result.insertId,
        category_name,
        description,
        icon
      }
    });
  } catch (error) {
    next(error);
  }
};

// อัพเดตหมวดหมู่
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category_name, description, icon } = req.body;

    // ตรวจสอบว่ามีหมวดหมู่นี้อยู่หรือไม่
    const categories = await db.query(`
      SELECT * FROM categories WHERE category_id = ?
    `, [id]);

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบหมวดหมู่นี้'
      });
    }

    // ตรวจสอบว่าชื่อหมวดหมู่ซ้ำหรือไม่
    if (category_name) {
      const existingCategories = await db.query(`
        SELECT * FROM categories 
        WHERE category_name = ? AND category_id != ?
      `, [category_name, id]);

      if (existingCategories.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'มีหมวดหมู่นี้อยู่แล้ว'
        });
      }
    }

    // อัพเดตหมวดหมู่
    await db.query(`
      UPDATE categories
      SET 
        category_name = COALESCE(?, category_name),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon)
      WHERE category_id = ?
    `, [
      category_name || null,
      description !== undefined ? description : null,
      icon || null,
      id
    ]);

    res.status(200).json({
      success: true,
      message: 'อัพเดตหมวดหมู่สำเร็จ'
    });
  } catch (error) {
    next(error);
  }
};

// ลบหมวดหมู่
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่ามีหมวดหมู่นี้อยู่หรือไม่
    const categories = await db.query(`
      SELECT * FROM categories WHERE category_id = ?
    `, [id]);

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบหมวดหมู่นี้'
      });
    }

    // ตรวจสอบว่ามีสถานที่ที่ใช้หมวดหมู่นี้อยู่หรือไม่
    const places = await db.query(`
      SELECT COUNT(*) as count FROM places WHERE category_id = ?
    `, [id]);

    if (places[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถลบหมวดหมู่นี้ได้เนื่องจากมีสถานที่ที่ใช้หมวดหมู่นี้อยู่'
      });
    }

    // ลบหมวดหมู่
    await db.query(`
      DELETE FROM categories WHERE category_id = ?
    `, [id]);

    res.status(200).json({
      success: true,
      message: 'ลบหมวดหมู่สำเร็จ'
    });
  } catch (error) {
    next(error);
  }
};