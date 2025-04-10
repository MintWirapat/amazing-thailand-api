const mysql = require('mysql2');
const util = require('util');
const dotenv = require('dotenv');

dotenv.config();

// สร้าง pool connection
const pool = mysql.createPool({
  host: process.env.DB_HOST  ,
  port: process.env.DB_PORT  ,
  user: process.env.DB_USER  ,
  password: process.env.DB_PASSWORD  ,
  database: process.env.DB_NAME  ,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// แปลง callback ให้เป็น promise
pool.query = util.promisify(pool.query).bind(pool);

// ฟังก์ชันสำหรับ execute query
const query = async (sql, params) => {
  try {
    const rows = await pool.query(sql, params );
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

module.exports = {
  pool,
  query
};