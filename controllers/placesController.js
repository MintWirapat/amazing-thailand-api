const db = require('../db/db');
const fs = require('fs');
const path = require('path');

// ดึงรายการสถานที่ท่องเที่ยวทั้งหมด
exports.getAllPlaces = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const category = req.query.category;
    const province = req.query.province;
    const sort = req.query.sort || 'newest'; // newest, oldest, likes, views

    let query = `
      SELECT 
        p.place_id, 
        p.title, 
        p.description, 
        p.location, 
        p.main_image, 
        p.created_at,
        p.views,
        p.likes,
        c.category_id,
        c.category_name,
        c.icon AS category_icon,
        pr.province_id,
        pr.province_name,
        pr.region,
        u.user_id,
        u.username,
        u.display_name,
        COUNT(DISTINCT com.comment_id) AS comment_count
      FROM places p
      JOIN categories c ON p.category_id = c.category_id
      JOIN provinces pr ON p.province_id = pr.province_id
      JOIN users u ON p.user_id = u.user_id
      LEFT JOIN comments com ON p.place_id = com.place_id AND com.is_active = TRUE
      WHERE p.is_active = TRUE
    `;
    
    const queryParams = [];
    
    if (category) {
      query += ` AND c.category_name = ?`;
      queryParams.push(category);
    }
    
    if (province) {
      query += ` AND pr.province_name = ?`;
      queryParams.push(province);
    }
    
    query += ` GROUP BY p.place_id`;
    
    // จัดเรียงลำดับ
    if (sort === 'oldest') {
      query += ` ORDER BY p.created_at ASC`;
    } else if (sort === 'likes') {
      query += ` ORDER BY p.likes DESC, p.created_at DESC`;
    } else if (sort === 'views') {
      query += ` ORDER BY p.views DESC, p.created_at DESC`;
    } else {
      // ค่าเริ่มต้น: newest
      query += ` ORDER BY p.created_at DESC`;
    }
    
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const places = await db.query(query, queryParams);
    
    // ดึงจำนวนสถานที่ทั้งหมดเพื่อใช้ในการทำ pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM places p
      JOIN categories c ON p.category_id = c.category_id
      JOIN provinces pr ON p.province_id = pr.province_id
      WHERE p.is_active = TRUE
    `;
    
    const countParams = [];
    
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

// ดึงข้อมูลสถานที่ท่องเที่ยวจาก ID
exports.getPlaceById = async (req, res, next) => {
  try {
    const placeId = req.params.id;
    
    // เพิ่มจำนวนการเข้าชม
    await db.query('CALL increment_place_view(?)', [placeId]);
    
    // ดึงข้อมูลสถานที่
    const places = await db.query(`
      SELECT 
        p.place_id, 
        p.title, 
        p.description, 
        p.location, 
        p.main_image, 
        p.latitude,
        p.longitude,
        p.created_at,
        p.updated_at,
        p.views,
        p.likes,
        c.category_id,
        c.category_name,
        c.icon AS category_icon,
        pr.province_id,
        pr.province_name,
        pr.region,
        u.user_id,
        u.username,
        u.display_name,
        u.profile_image
      FROM places p
      JOIN categories c ON p.category_id = c.category_id
      JOIN provinces pr ON p.province_id = pr.province_id
      JOIN users u ON p.user_id = u.user_id
      WHERE p.place_id = ? AND p.is_active = TRUE
    `, [placeId]);
    
    if (places.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสถานที่ท่องเที่ยวนี้'
      });
    }
    
    const place = places[0];
    
    // ดึงรูปภาพเพิ่มเติม
    const images = await db.query(
      'SELECT image_id, image_url, caption FROM place_images WHERE place_id = ?',
      [placeId]
    );
    
    // ดึงแท็ก
    const tags = await db.query(`
      SELECT t.tag_id, t.tag_name
      FROM tags t
      JOIN place_tags pt ON t.tag_id = pt.tag_id
      WHERE pt.place_id = ?
    `, [placeId]);
    
    // ดึงความคิดเห็น
    const comments = await db.query(`
      SELECT 
        c.comment_id, c.content, c.rating, c.created_at, c.updated_at,
        u.user_id, u.username, u.display_name, u.profile_image
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.place_id = ? AND c.is_active = TRUE
      ORDER BY c.created_at DESC
      LIMIT 10
    `, [placeId]);
    
    // ดึงจำนวนความคิดเห็นทั้งหมด
    const commentCount = await db.query(
      'SELECT COUNT(*) as total FROM comments WHERE place_id = ? AND is_active = TRUE',
      [placeId]
    );
    
    // ตรวจสอบว่าผู้ใช้ปัจจุบันกดไลค์หรือบันทึกสถานที่นี้หรือไม่
    let userLiked = false;
    let userFavorited = false;
    
    if (req.user) {
      const userInteractions = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM likes WHERE user_id = ? AND place_id = ?) as liked,
          (SELECT COUNT(*) FROM user_favorites WHERE user_id = ? AND place_id = ?) as favorited
      `, [req.user.id, placeId, req.user.id, placeId]);
      
      userLiked = userInteractions[0].liked > 0;
      userFavorited = userInteractions[0].favorited > 0;
    }
    
    // ดึงสถานที่ท่องเที่ยวใกล้เคียง (อยู่ในจังหวัดเดียวกัน)
    const relatedPlaces = await db.query(`
      SELECT 
        p.place_id, p.title, p.location, p.main_image,
        c.category_name
      FROM places p
      JOIN categories c ON p.category_id = c.category_id
      WHERE p.province_id = ? AND p.place_id != ? AND p.is_active = TRUE
      ORDER BY RAND()
      LIMIT 4
    `, [place.province_id, place.place_id]);
    
    res.status(200).json({
      success: true,
      data: {
        ...place,
        images,
        tags,
        comments,
        comment_count: commentCount[0].total,
        related_places: relatedPlaces,
        user_interactions: {
          liked: userLiked,
          favorited: userFavorited
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// สร้างสถานที่ท่องเที่ยวใหม่
exports.createPlace = async (req, res, next) => {
  try {
    const { 
      title, 
      description, 
      location, 
      province_id, 
      category_id, 
      latitude, 
      longitude,
      tags 
    } = req.body;
    
    // ตรวจสอบว่ามีการอัปโหลดรูปภาพหลักหรือไม่
    console.log('req.files', req.files);

    if (!req.files || !req.files.main_image) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาอัปโหลดรูปภาพหลัก'
      });
    }
    
    // เก็บชื่อไฟล์รูปภาพหลัก
    const mainImageFile = req.files.main_image[0].filename;
    
    // เพิ่มข้อมูลสถานที่
    const result = await db.query(`
      INSERT INTO places 
      (title, description, location, province_id, category_id, user_id, main_image, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [title, description, location, province_id, category_id, req.user.id, mainImageFile, latitude || null, longitude || null]);
    
    const placeId = result.insertId;
    
    // เพิ่มรูปภาพเพิ่มเติม (ถ้ามี)
    if (req.files && req.files.gallery) {
      const galleryPromises = req.files.gallery.map(file => {
        return db.query(
          'INSERT INTO place_images (place_id, image_url, caption) VALUES (?, ?, ?)',
          [placeId, file.filename, '']
        );
      });
      
      await Promise.all(galleryPromises);
    }
    
    // เพิ่มแท็ก (ถ้ามี)
    if (tags && tags.length > 0) {
      // แปลง tags จาก string เป็น array ถ้าเป็น string
      const tagArray = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : tags;
      
      for (const tagName of tagArray) {
        // ตรวจสอบว่าแท็กมีอยู่แล้วหรือไม่
        let tagResult = await db.query('SELECT tag_id FROM tags WHERE tag_name = ?', [tagName]);
        
        let tagId;
        if (tagResult.length === 0) {
          // สร้างแท็กใหม่
          const newTagResult = await db.query('INSERT INTO tags (tag_name) VALUES (?)', [tagName]);
          tagId = newTagResult.insertId;
        } else {
          tagId = tagResult[0].tag_id;
        }
        
        // เพิ่มความสัมพันธ์ระหว่างสถานที่และแท็ก
        await db.query('INSERT INTO place_tags (place_id, tag_id) VALUES (?, ?)', [placeId, tagId]);
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'สร้างสถานที่ท่องเที่ยวสำเร็จ',
      data: {
        place_id: placeId
      }
    });
  } catch (error) {
    // ลบไฟล์ที่อัปโหลดในกรณีที่เกิดข้อผิดพลาด
    if (req.files) {
      for (const fileType in req.files) {
        const files = req.files[fileType];
        files.forEach(file => {
          fs.unlink(path.join(__dirname, '../uploads', file.filename), err => {
            if (err) console.error('Error deleting file:', err);
          });
        });
      }
    }
    
    next(error);
  }
};

// อัพเดตสถานที่ท่องเที่ยว
exports.updatePlace = async (req, res, next) => {
  try {
    const placeId = req.params.id;
    const { 
      title, 
      description, 
      location, 
      province_id, 
      category_id, 
      latitude, 
      longitude,
      tags 
    } = req.body;
    
    // ตรวจสอบว่าสถานที่มีอยู่หรือไม่
    const places = await db.query('SELECT * FROM places WHERE place_id = ?', [placeId]);
    
    if (places.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสถานที่ท่องเที่ยวนี้'
      });
    }
    
    const place = places[0];
    
    // ตรวจสอบว่าผู้ใช้เป็นเจ้าของสถานที่หรือไม่
    if (place.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'คุณไม่มีสิทธิ์แก้ไขสถานที่นี้'
      });
    }
    
    // สร้าง object สำหรับอัพเดต
    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (location) updateData.location = location;
    if (province_id) updateData.province_id = province_id;
    if (category_id) updateData.category_id = category_id;
    if (latitude) updateData.latitude = latitude;
    if (longitude) updateData.longitude = longitude;
    
    // อัพเดตรูปภาพหลัก (ถ้ามี)
    if (req.files && req.files.main_image) {
      // ลบรูปภาพเก่า
      const oldImagePath = path.join(__dirname, '../uploads', place.main_image);
      fs.unlink(oldImagePath, err => {
        if (err && err.code !== 'ENOENT') console.error('Error deleting old image:', err);
      });
      
      updateData.main_image = req.files.main_image[0].filename;
    }
    
    // อัพเดตข้อมูลสถานที่
    if (Object.keys(updateData).length > 0) {
      const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updateData);
      
      await db.query(`UPDATE places SET ${fields}, updated_at = NOW() WHERE place_id = ?`, [...values, placeId]);
    }
    
    // อัพเดตแท็ก (ถ้ามี)
    if (tags) {
      // ลบแท็กเก่า
      await db.query('DELETE FROM place_tags WHERE place_id = ?', [placeId]);
      
      // เพิ่มแท็กใหม่
      const tagArray = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : tags;
      
      for (const tagName of tagArray) {
        let tagResult = await db.query('SELECT tag_id FROM tags WHERE tag_name = ?', [tagName]);
        
        let tagId;
        if (tagResult.length === 0) {
          const newTagResult = await db.query('INSERT INTO tags (tag_name) VALUES (?)', [tagName]);
          tagId = newTagResult.insertId;
        } else {
          tagId = tagResult[0].tag_id;
        }
        
        await db.query('INSERT INTO place_tags (place_id, tag_id) VALUES (?, ?)', [placeId, tagId]);
      }
    }
    
    // อัพเดตรูปภาพแกลเลอรี (ถ้ามี)
    if (req.files && req.files.gallery) {
      // เพิ่มรูปภาพใหม่
      const galleryPromises = req.files.gallery.map(file => {
        return db.query(
          'INSERT INTO place_images (place_id, image_url, caption) VALUES (?, ?, ?)',
          [placeId, file.filename, '']
        );
      });
      
      await Promise.all(galleryPromises);
    }
    
    res.status(200).json({
      success: true,
      message: 'อัพเดตสถานที่ท่องเที่ยวสำเร็จ'
    });
  } catch (error) {
    // ลบไฟล์ที่อัปโหลดในกรณีที่เกิดข้อผิดพลาด
    if (req.files) {
      for (const fileType in req.files) {
        const files = req.files[fileType];
        files.forEach(file => {
          fs.unlink(path.join(__dirname, '../uploads', file.filename), err => {
            if (err) console.error('Error deleting file:', err);
          });
        });
      }
    }
    
    next(error);
  }
};

// ลบสถานที่ท่องเที่ยว
exports.deletePlace = async (req, res, next) => {
  try {
    const placeId = req.params.id;
    
    // ตรวจสอบว่าสถานที่มีอยู่หรือไม่
    const places = await db.query('SELECT * FROM places WHERE place_id = ?', [placeId]);
    
    if (places.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสถานที่ท่องเที่ยวนี้'
      });
    }
    
    const place = places[0];
    
    // ตรวจสอบว่าผู้ใช้เป็นเจ้าของสถานที่หรือไม่
    if (place.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'คุณไม่มีสิทธิ์ลบสถานที่นี้'
      });
    }
    
    // ดึงรูปภาพทั้งหมดของสถานที่
    const images = await db.query('SELECT image_url FROM place_images WHERE place_id = ?', [placeId]);
    
    // ลบข้อมูลสถานที่จากฐานข้อมูล (ใช้ soft delete)
    await db.query('UPDATE places SET is_active = FALSE WHERE place_id = ?', [placeId]);
    
    // ลบไฟล์รูปภาพหลัก (ในกรณีที่ต้องการลบไฟล์จริงๆ)
    // const mainImagePath = path.join(__dirname, '../uploads', place.main_image);
    // fs.unlink(mainImagePath, err => {
    //   if (err && err.code !== 'ENOENT') console.error('Error deleting main image:', err);
    // });
    
    // ลบไฟล์รูปภาพเพิ่มเติม (ในกรณีที่ต้องการลบไฟล์จริงๆ)
    // images.forEach(image => {
    //   const imagePath = path.join(__dirname, '../uploads', image.image_url);
    //   fs.unlink(imagePath, err => {
    //     if (err && err.code !== 'ENOENT') console.error('Error deleting image:', err);
    //   });
    // });
    
    res.status(200).json({
      success: true,
      message: 'ลบสถานที่ท่องเที่ยวสำเร็จ'
    });
  } catch (error) {
    next(error);
  }
};

// กดไลค์/ยกเลิกการไลค์สถานที่
exports.toggleLike = async (req, res, next) => {
  try {
    const placeId = req.params.id;
    const userId = req.user.id;
    
    // ตรวจสอบว่าสถานที่มีอยู่หรือไม่
    const places = await db.query('SELECT * FROM places WHERE place_id = ? AND is_active = TRUE', [placeId]);
    
    if (places.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสถานที่ท่องเที่ยวนี้'
      });
    }
    
    // ตรวจสอบว่าผู้ใช้ได้กดไลค์สถานที่นี้ไปแล้วหรือไม่
    const likes = await db.query(
      'SELECT * FROM likes WHERE place_id = ? AND user_id = ?',
      [placeId, userId]
    );
    
    let liked;
    if (likes.length > 0) {
      // ถ้าเคยไลค์แล้ว ให้ยกเลิกการไลค์
      await db.query(
        'DELETE FROM likes WHERE place_id = ? AND user_id = ?',
        [placeId, userId]
      );
      liked = false;
    } else {
      // ถ้ายังไม่เคยไลค์ ให้เพิ่มการไลค์
      await db.query(
        'INSERT INTO likes (place_id, user_id) VALUES (?, ?)',
        [placeId, userId]
      );
      liked = true;
    }
    
    // ดึงจำนวนไลค์ล่าสุด
    const likesCount = await db.query(
      'SELECT COUNT(*) as count FROM likes WHERE place_id = ?',
      [placeId]
    );
    
    res.status(200).json({
      success: true,
      message: liked ? 'กดไลค์สำเร็จ' : 'ยกเลิกการไลค์สำเร็จ',
      data: {
        liked,
        likes_count: likesCount[0].count
      }
    });
  } catch (error) {
    next(error);
  }
};

// บันทึก/ยกเลิกการบันทึกสถานที่
exports.toggleFavorite = async (req, res, next) => {
  try {
    const placeId = req.params.id;
    const userId = req.user.id;
    
    // ตรวจสอบว่าสถานที่มีอยู่หรือไม่
    const places = await db.query('SELECT * FROM places WHERE place_id = ? AND is_active = TRUE', [placeId]);
    
    if (places.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสถานที่ท่องเที่ยวนี้'
      });
    }
    
    // ตรวจสอบว่าผู้ใช้ได้บันทึกสถานที่นี้ไปแล้วหรือไม่
    const favorites = await db.query(
      'SELECT * FROM user_favorites WHERE place_id = ? AND user_id = ?',
      [placeId, userId]
    );
    
    let favorited;
    if (favorites.length > 0) {
      // ถ้าเคยบันทึกแล้ว ให้ยกเลิกการบันทึก
      await db.query(
        'DELETE FROM user_favorites WHERE place_id = ? AND user_id = ?',
        [placeId, userId]
      );
      favorited = false;
    } else {
      // ถ้ายังไม่เคยบันทึก ให้เพิ่มการบันทึก
      await db.query(
        'INSERT INTO user_favorites (place_id, user_id) VALUES (?, ?)',
        [placeId, userId]
      );
      favorited = true;
    }
    
    res.status(200).json({
      success: true,
      message: favorited ? 'บันทึกสถานที่สำเร็จ' : 'ยกเลิกการบันทึกสถานที่สำเร็จ',
      data: {
        favorited
      }
    });
  } catch (error) {
    next(error);
  }
};

// ดึงสถานที่ท่องเที่ยวยอดนิยม
exports.getPopularPlaces = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const category = req.query.category;
    
    let query = `
      SELECT * FROM popular_places
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    if (category) {
      query += ` AND category_name = ?`;
      queryParams.push(category);
    }
    
    query += ` LIMIT ?`;
    queryParams.push(limit);
    
    const places = await db.query(query, queryParams);
    
    res.status(200).json({
      success: true,
      count: places.length,
      data: places
    });
  } catch (error) {
    next(error);
  }
};

// ดึงสถานที่ท่องเที่ยวใกล้เคียง
exports.getNearbyPlaces = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    const limit = parseInt(req.query.limit) || 6;
    const distance = parseFloat(req.query.distance) || 50; // ค่าเริ่มต้น 50 กิโลเมตร
    
    // ตรวจสอบว่ามีค่าพิกัด (latitude, longitude) หรือไม่
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุพิกัด (latitude, longitude)'
      });
    }
    
    // คำนวณระยะทางด้วย Haversine formula
    const places = await db.query(`
      SELECT 
        p.place_id, p.title, p.location, p.main_image,
        c.category_name, c.icon as category_icon,
        pr.province_name,
        (
          6371 * acos(
            cos(radians(?)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(?)) + 
            sin(radians(?)) * sin(radians(p.latitude))
          )
        ) AS distance,
        p.likes,
        p.views
      FROM places p
      JOIN categories c ON p.category_id = c.category_id
      JOIN provinces pr ON p.province_id = pr.province_id
      WHERE p.is_active = TRUE AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      HAVING distance <= ?
      ORDER BY distance ASC
      LIMIT ?
    `, [lat, lng, lat, distance, limit]);
    
    res.status(200).json({
      success: true,
      count: places.length,
      data: places
    });
  } catch (error) {
    next(error);
  }
};