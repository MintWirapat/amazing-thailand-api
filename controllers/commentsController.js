const db = require('../db/db');

// เพิ่มความคิดเห็นใหม่
exports.addComment = async (req, res, next) => {
  try {
    const { place_id, content } = req.body;
    const user_id = req.user.id;

    // ตรวจสอบว่าสถานที่มีอยู่หรือไม่
    const places = await db.query('SELECT * FROM places WHERE place_id = ? AND is_active = TRUE', [place_id]);
    
    if (places.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสถานที่ท่องเที่ยวนี้'
      });
    }

    console.log('place', place_id);
    console.log('user_id', user_id);
    // ตรวจสอบว่าผู้ใช้มีสิทธิ์ในการแสดงความคิดเห็นหรือไม่
    // ตรวจสอบว่าผู้ใช้เคยแสดงความคิดเห็นในสถานที่นี้แล้วหรือไม่
    
    console.log('content', content);
    // ถ้าผู้ใช้เป็นเจ้าของสถานที่ ให้คืนค่าข้อความแสดงข้อผิดพลาด
    // ถ้ามีความคิดเห็นอยู่แล้ว ให้คืนค่าข้อความแสดงข้อผิดพลาด

    // ตรวจสอบเนื้อหาความคิดเห็น
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุเนื้อหาความคิดเห็น'
      });
    }

    // ตรวจสอบความถูกต้องของคะแนน

    // เพิ่มความคิดเห็น
    const result = await db.query(
      'INSERT INTO comments (place_id, user_id, content) VALUES (?, ?, ?)', // แก้ไขตรงนี้ เพิ่มเครื่องหมาย ,
      [place_id, user_id, content]
    );

    // ดึงข้อมูลผู้ใช้
    const users = await db.query(
      'SELECT user_id, username, display_name, profile_image FROM users WHERE user_id = ?',
      [user_id]
    );

    res.status(201).json({
      success: true,
      message: 'เพิ่มความคิดเห็นสำเร็จ',
      data: {
        comment_id: result.insertId,
        content,
        created_at: new Date(),
        user: users[0]
      }
    });
  } catch (error) {
    console.error('Error in addComment:', error);
    error.statusCode = error.statusCode || 500;
    next(error);
  }
};

// แก้ไขความคิดเห็น
exports.updateComment = async (req, res, next) => {
  try {
    const { comment_id } = req.params;
    const { content, rating } = req.body;
    const user_id = req.user.id;

    // ตรวจสอบเนื้อหาความคิดเห็น
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุเนื้อหาความคิดเห็น'
      });
    }

    // ตรวจสอบความถูกต้องของคะแนน
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'คะแนนต้องอยู่ระหว่าง 1-5'
      });
    }

    // ตรวจสอบว่าความคิดเห็นมีอยู่หรือไม่
    const comments = await db.query(
      'SELECT * FROM comments WHERE comment_id = ? AND is_active = TRUE',
      [comment_id]
    );
    
    if (comments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบความคิดเห็นนี้'
      });
    }

    const comment = comments[0];

    // ตรวจสอบว่าผู้ใช้เป็นเจ้าของความคิดเห็นหรือไม่
    if (comment.user_id !== user_id && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'คุณไม่มีสิทธิ์แก้ไขความคิดเห็นนี้'
      });
    }

    // อัพเดตความคิดเห็น
    await db.query(
      'UPDATE comments SET content = ?, rating = ?, updated_at = NOW() WHERE comment_id = ?',
      [content, rating || comment.rating, comment_id]
    );

    res.status(200).json({
      success: true,
      message: 'แก้ไขความคิดเห็นสำเร็จ',
      data: {
        comment_id: parseInt(comment_id),
        content,
        rating: rating || comment.rating,
        updated_at: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

// ลบความคิดเห็น
exports.deleteComment = async (req, res, next) => {
  try {
    const { comment_id } = req.params;
    const user_id = req.user.id;

    // ตรวจสอบว่าความคิดเห็นมีอยู่หรือไม่
    const comments = await db.query(
      'SELECT c.*, p.user_id as place_owner_id FROM comments c JOIN places p ON c.place_id = p.place_id WHERE c.comment_id = ? AND c.is_active = TRUE',
      [comment_id]
    );
    
    if (comments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบความคิดเห็นนี้'
      });
    }

    const comment = comments[0];

    // ตรวจสอบว่าผู้ใช้เป็นเจ้าของความคิดเห็นหรือเจ้าของสถานที่หรือไม่
    const isCommentOwner = comment.user_id === user_id;
    const isPlaceOwner = comment.place_owner_id === user_id;
    
    if (!isCommentOwner && !isPlaceOwner && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'คุณไม่มีสิทธิ์ลบความคิดเห็นนี้'
      });
    }

    // ลบความคิดเห็น (ใช้การ soft delete)
    await db.query(
      'UPDATE comments SET is_active = FALSE WHERE comment_id = ?',
      [comment_id]
    );

    res.status(200).json({
      success: true,
      message: 'ลบความคิดเห็นสำเร็จ'
    });
  } catch (error) {
    next(error);
  }
};

// ดึงความคิดเห็นทั้งหมดของสถานที่
exports.getPlaceComments = async (req, res, next) => {
  try {
    const { place_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sort = req.query.sort || 'newest'; // newest, oldest, rating_high, rating_low

    // ตรวจสอบว่าสถานที่มีอยู่หรือไม่
    const places = await db.query(
      'SELECT * FROM places WHERE place_id = ? AND is_active = TRUE',
      [place_id]
    );
    
    if (places.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสถานที่ท่องเที่ยวนี้'
      });
    }

    // สร้าง query สำหรับดึงความคิดเห็น
    let query = `
      SELECT 
        c.comment_id, c.content, c.rating, c.created_at, c.updated_at,
        u.user_id, u.username, u.display_name, u.profile_image
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.place_id = ? AND c.is_active = TRUE
    `;

    // จัดเรียงลำดับความคิดเห็น
    if (sort === 'oldest') {
      query += ` ORDER BY c.created_at ASC`;
    } else if (sort === 'rating_high') {
      query += ` ORDER BY c.rating DESC, c.created_at DESC`;
    } else if (sort === 'rating_low') {
      query += ` ORDER BY c.rating ASC, c.created_at DESC`;
    } else {
      // คา่เริ่มต้น: newest
      query += ` ORDER BY c.created_at DESC`;
    }

    query += ` LIMIT ? OFFSET ?`;

    // ดึงความคิดเห็น
    const comments = await db.query(query, [place_id, limit, offset]);

    // ดึงจำนวนความคิดเห็นทั้งหมด
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM comments WHERE place_id = ? AND is_active = TRUE',
      [place_id]
    );
    
    const total = countResult[0].total;

    // คำนวณค่าเฉลี่ยคะแนน
    const ratingResult = await db.query(
      'SELECT AVG(rating) as avg_rating, COUNT(rating) as rating_count FROM comments WHERE place_id = ? AND is_active = TRUE AND rating IS NOT NULL',
      [place_id]
    );
    
    const avgRating = ratingResult[0].avg_rating;
    const ratingCount = ratingResult[0].rating_count;

    // นับจำนวนความคิดเห็นตามคะแนน
    const ratingDistribution = await db.query(
      'SELECT rating, COUNT(*) as count FROM comments WHERE place_id = ? AND is_active = TRUE AND rating IS NOT NULL GROUP BY rating ORDER BY rating DESC',
      [place_id]
    );

    res.status(200).json({
      success: true,
      count: comments.length,
      total,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        per_page: limit
      },
      ratings: {
        average: avgRating ? parseFloat(avgRating.toFixed(1)) : 0,
        count: ratingCount,
        distribution: ratingDistribution
      },
      data: comments
    });
  } catch (error) {
    next(error);
  }
};

// ดึงความคิดเห็นทั้งหมดของผู้ใช้
exports.getUserComments = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // ดึงความคิดเห็นทั้งหมดของผู้ใช้
    const comments = await db.query(`
      SELECT 
        c.comment_id, c.content, c.rating, c.created_at, c.updated_at,
        p.place_id, p.title as place_title, p.main_image, p.location
      FROM comments c
      JOIN places p ON c.place_id = p.place_id
      WHERE c.user_id = ? AND c.is_active = TRUE AND p.is_active = TRUE
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [user_id, limit, offset]);

    // ดึงจำนวนความคิดเห็นทั้งหมดของผู้ใช้
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM comments c
      JOIN places p ON c.place_id = p.place_id
      WHERE c.user_id = ? AND c.is_active = TRUE AND p.is_active = TRUE
    `, [user_id]);
    
    const total = countResult[0].total;

    res.status(200).json({
      success: true,
      count: comments.length,
      total,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        per_page: limit
      },
      data: comments
    });
  } catch (error) {
    next(error);
  }
};

// ถูกใจความคิดเห็น (ฟีเจอร์เพิ่มเติม - ไม่อยู่ในโจทย์หลัก)
exports.likeComment = async (req, res, next) => {
  try {
    const { comment_id } = req.params;
    const user_id = req.user.id;

    // ตรวจสอบว่าความคิดเห็นมีอยู่หรือไม่
    const comments = await db.query(
      'SELECT * FROM comments WHERE comment_id = ? AND is_active = TRUE',
      [comment_id]
    );
    
    if (comments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบความคิดเห็นนี้'
      });
    }

    // ตรวจสอบว่าผู้ใช้ได้กดถูกใจความคิดเห็นนี้ไปแล้วหรือไม่
    const commentLikes = await db.query(
      'SELECT * FROM comment_likes WHERE comment_id = ? AND user_id = ?',
      [comment_id, user_id]
    );
    
    let liked;
    if (commentLikes.length > 0) {
      // ถ้าเคยถูกใจแล้ว ให้ยกเลิกการถูกใจ
      await db.query(
        'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?',
        [comment_id, user_id]
      );
      liked = false;
    } else {
      // ถ้ายังไม่เคยถูกใจ ให้เพิ่มการถูกใจ
      await db.query(
        'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)',
        [comment_id, user_id]
      );
      liked = true;
    }

    // ดึงจำนวนถูกใจล่าสุด
    const likesCount = await db.query(
      'SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?',
      [comment_id]
    );

    res.status(200).json({
      success: true,
      message: liked ? 'ถูกใจความคิดเห็นสำเร็จ' : 'ยกเลิกการถูกใจความคิดเห็นสำเร็จ',
      data: {
        liked,
        likes_count: likesCount[0].count
      }
    });
  } catch (error) {
    next(error);
  }
};