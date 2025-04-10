const db = require('../db/db');

// ค้นหาสถานที่ท่องเที่ยว
exports.searchPlaces = async (req, res, next) => {
  try {
    const { q, category, province, sort } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // สร้าง query สำหรับค้นหา
    let query = `
      SELECT p.place_id, p.title, p.location, p.description, p.main_image, p.created_at,
             c.category_name, c.icon as category_icon,
             pr.province_name, pr.region,
             u.username, u.display_name,
             COUNT(DISTINCT l.like_id) as likes_count,
             COUNT(DISTINCT com.comment_id) as comments_count
      FROM places p
      JOIN categories c ON p.category_id = c.category_id
      JOIN provinces pr ON p.province_id = pr.province_id
      JOIN users u ON p.user_id = u.user_id
      LEFT JOIN place_tags pt ON p.place_id = pt.place_id
      LEFT JOIN tags t ON pt.tag_id = t.tag_id
      LEFT JOIN likes l ON p.place_id = l.place_id
      LEFT JOIN comments com ON p.place_id = com.place_id AND com.is_active = TRUE
      WHERE p.is_active = TRUE
    `;
    
    const queryParams = [];
    
    // เพิ่มเงื่อนไขการค้นหา
    if (q) {
      query += ` AND (
        p.title LIKE ? OR 
        p.description LIKE ? OR 
        p.location LIKE ? OR 
        pr.province_name LIKE ? OR 
        t.tag_name LIKE ?
      )`;
      const searchTerm = `%${q}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (category) {
      query += ` AND c.category_name = ?`;
      queryParams.push(category);
    }
    
    if (province) {
      query += ` AND pr.province_name = ?`;
      queryParams.push(province);
    }
    
    // Group by เพื่อรวมผลลัพธ์
    query += ` GROUP BY p.place_id`;
    
    // เรียงลำดับผลลัพธ์
    if (sort === 'likes') {
      query += ` ORDER BY likes_count DESC, p.created_at DESC`;
    } else if (sort === 'comments') {
      query += ` ORDER BY comments_count DESC, p.created_at DESC`;
    } else if (sort === 'oldest') {
      query += ` ORDER BY p.created_at ASC`;
    } else {
      // default: newest
      query += ` ORDER BY p.created_at DESC`;
    }
    
    // เพิ่ม limit และ offset
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);
    
    // ดึงข้อมูลสถานที่
    const places = await db.query(query, queryParams);
    
    // นับจำนวนผลลัพธ์ทั้งหมด
    let countQuery = `
      SELECT COUNT(DISTINCT p.place_id) as total
      FROM places p
      JOIN categories c ON p.category_id = c.category_id
      JOIN provinces pr ON p.province_id = pr.province_id
      LEFT JOIN place_tags pt ON p.place_id = pt.place_id
      LEFT JOIN tags t ON pt.tag_id = t.tag_id
      WHERE p.is_active = TRUE
    `;
    
    const countParams = [];
    
    if (q) {
      countQuery += ` AND (
        p.title LIKE ? OR 
        p.description LIKE ? OR 
        p.location LIKE ? OR 
        pr.province_name LIKE ? OR 
        t.tag_name LIKE ?
      )`;
      const searchTerm = `%${q}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (category) {
      countQuery += ` AND c.category_name = ?`;
      countParams.push(category);
    }
    
    if (province) {
      countQuery += ` AND pr.province_name = ?`;
      countParams.push(province);
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

// ค้นหาแบบแนะนำ (autocomplete)
exports.suggestPlaces = async (req, res, next) => {
  try {
    const { q } = req.query;
    const limit = parseInt(req.query.limit) || 5;
    
    if (!q) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }
    
    // ค้นหาสถานที่
    const places = await db.query(`
      SELECT p.place_id, p.title, p.location, p.main_image,
             pr.province_name, c.category_name, 'place' as type
      FROM places p
      JOIN provinces pr ON p.province_id = pr.province_id
      JOIN categories c ON p.category_id = c.category_id
      WHERE p.is_active = TRUE AND (
        p.title LIKE ? OR
        p.location LIKE ?
      )
      ORDER BY 
        CASE 
          WHEN p.title LIKE ? THEN 0
          WHEN p.title LIKE ? THEN 1
          ELSE 2
        END,
        p.title
      LIMIT ?
    `, [`${q}%`, `%${q}%`, `${q}%`, `%${q}%`, limit]);
    
    // ค้นหาจังหวัด
    const provinces = await db.query(`
      SELECT province_id, province_name, region, image, 'province' as type
      FROM provinces
      WHERE province_name LIKE ?
      ORDER BY 
        CASE 
          WHEN province_name LIKE ? THEN 0
          ELSE 1
        END,
        province_name
      LIMIT ?
    `, [`%${q}%`, `${q}%`, limit]);
    
    // ค้นหาแท็ก
    const tags = await db.query(`
      SELECT tag_id, tag_name, 'tag' as type,
             COUNT(pt.place_id) as place_count
      FROM tags t
      LEFT JOIN place_tags pt ON t.tag_id = pt.tag_id
      WHERE t.tag_name LIKE ?
      GROUP BY t.tag_id
      ORDER BY 
        CASE 
          WHEN t.tag_name LIKE ? THEN 0
          ELSE 1
        END,
        place_count DESC,
        t.tag_name
      LIMIT ?
    `, [`%${q}%`, `${q}%`, limit]);
    
    // รวมผลลัพธ์
    const results = [...places, ...provinces, ...tags];
    
    // จัดเรียงผลลัพธ์ แสดงผลที่ตรงที่สุดก่อน
    results.sort((a, b) => {
      // จัดเรียงตาม type
      if (a.type !== b.type) {
        if (a.type === 'place') return -1;
        if (b.type === 'place') return 1;
        if (a.type === 'province') return -1;
        if (b.type === 'province') return 1;
      }
      
      // สำหรับสถานที่ จัดเรียงตามความตรงของชื่อ
      if (a.type === 'place' && b.type === 'place') {
        const aStartsWith = a.title.toLowerCase().startsWith(q.toLowerCase());
        const bStartsWith = b.title.toLowerCase().startsWith(q.toLowerCase());
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
      }
      
      return 0;
    });
    
    // จำกัดจำนวนผลลัพธ์
    const limitedResults = results.slice(0, limit);
    
    res.status(200).json({
      success: true,
      count: limitedResults.length,
      data: limitedResults
    });
  } catch (error) {
    next(error);
  }
};

// ค้นหาสถานที่ใกล้เคียง
exports.searchNearby = async (req, res, next) => {
  try {
    const { lat, lng, distance, category } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // ตรวจสอบว่ามีค่าพิกัด (latitude, longitude) หรือไม่
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุพิกัด (latitude, longitude)'
      });
    }
    
    // กำหนดระยะทาง (หน่วยเป็นกิโลเมตร) ถ้าไม่ได้ระบุให้ใช้ค่าเริ่มต้น 10 กิโลเมตร
    const searchDistance = distance ? parseFloat(distance) : 10;
    
    // คำนวณระยะทางด้วย Haversine formula
    let query = `
      SELECT p.place_id, p.title, p.location, p.description, p.main_image, 
             p.latitude, p.longitude, c.category_name, c.icon as category_icon,
             pr.province_name, u.username, u.display_name,
             (
                 6371 * acos(
                     cos(radians(?)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(?)) + 
                     sin(radians(?)) * sin(radians(p.latitude))
                 )
             ) AS distance,
             COUNT(DISTINCT l.like_id) as likes_count,
             COUNT(DISTINCT com.comment_id) as comments_count
      FROM places p
      JOIN categories c ON p.category_id = c.category_id
      JOIN provinces pr ON p.province_id = pr.province_id
      JOIN users u ON p.user_id = u.user_id
      LEFT JOIN likes l ON p.place_id = l.place_id
      LEFT JOIN comments com ON p.place_id = com.place_id AND com.is_active = TRUE
      WHERE p.is_active = TRUE AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
    `;
    
    const queryParams = [lat, lng, lat];
    
    // เพิ่มเงื่อนไขหมวดหมู่ (ถ้ามี)
    if (category) {
      query += ` AND c.category_name = ?`;
      queryParams.push(category);
    }
    
    // จำกัดระยะทาง
    query += ` HAVING distance <= ?`;
    queryParams.push(searchDistance);
    
    // เรียงลำดับตามระยะทางใกล้ที่สุดก่อน
    query += ` ORDER BY distance ASC, p.created_at DESC`;
    
    // เพิ่ม limit และ offset
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);
    
    // ดึงข้อมูลสถานที่ใกล้เคียง
    const places = await db.query(query, queryParams);
    
    // นับจำนวนผลลัพธ์ทั้งหมด
    let countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT p.place_id,
               (
                   6371 * acos(
                       cos(radians(?)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(?)) + 
                       sin(radians(?)) * sin(radians(p.latitude))
                   )
               ) AS distance
        FROM places p
        JOIN categories c ON p.category_id = c.category_id
        WHERE p.is_active = TRUE AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
    `;
    
    const countParams = [lat, lng, lat];
    
    if (category) {
      countQuery += ` AND c.category_name = ?`;
      countParams.push(category);
    }
    
    countQuery += ` HAVING distance <= ?`;
    countParams.push(searchDistance);
    
    countQuery += `) as subquery`;
    
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