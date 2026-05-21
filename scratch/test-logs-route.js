import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'wifi_itats.db'
  });

  const reqQuery = {
    device_id: '12',
    limit: '100',
    page: '1',
    grouped: 'false'
  };

  const { device_id, search, topics, limit = 100, page = 1, grouped = 'false', startDate, endDate, sort = 'desc' } = reqQuery;
  const isGrouped = grouped === 'true';
  
  let query = "";
  const params = [];
  const offset = (Number(page) - 1) * Number(limit);

  if (isGrouped) {
    query = `
      SELECT 
        l.message, 
        l.topics, 
        l.device_id,
        d.name as device_name,
        COUNT(*) as occurrences,
        MAX(l.created_at) as last_seen,
        MIN(l.created_at) as first_seen,
        MAX(l.id) as max_id
      FROM mikrotik_logs l 
      LEFT JOIN mikrotik_devices d ON l.device_id = d.id 
      WHERE 1=1
    `;
  } else {
    query = "SELECT l.*, d.name as device_name FROM mikrotik_logs l LEFT JOIN mikrotik_devices d ON l.device_id = d.id WHERE 1=1";
  }
  
  if (device_id) {
    query += " AND l.device_id = ?";
    params.push(device_id);
  }
  
  if (search) {
    query += " AND l.message LIKE ?";
    params.push(`%${search}%`);
  }
  
  if (topics) {
    query += " AND l.topics LIKE ?";
    params.push(`%${topics}%`);
  }
  
  if (startDate) {
    query += " AND l.created_at >= ?";
    params.push(startDate.replace('T', ' '));
  }
  if (endDate) {
    query += " AND l.created_at <= ?";
    params.push(endDate.replace('T', ' '));
  }

  if (isGrouped) {
    query += ` GROUP BY l.device_id, d.name, l.message, l.topics ORDER BY last_seen ${sort === 'asc' ? 'ASC' : 'DESC'}`;
  } else {
    query += ` ORDER BY l.id ${sort === 'asc' ? 'ASC' : 'DESC'}`;
  }

  query += " LIMIT ? OFFSET ?";
  params.push(Number(limit), offset);

  console.log('Query:', query);
  console.log('Params:', params);
  
  const [rows] = await db.query(query, params);
  console.log('Rows count:', rows.length);
  
  // Count total for pagination
  let countQuery = "";
  const countParams = [];
  if (isGrouped) {
     countQuery = "SELECT COUNT(*) as total FROM (SELECT 1 FROM mikrotik_logs l WHERE 1=1";
  } else {
     countQuery = "SELECT COUNT(*) as total FROM mikrotik_logs l WHERE 1=1";
  }

  if (device_id) { countQuery += " AND l.device_id = ?"; countParams.push(device_id); }
  if (search) { countQuery += " AND l.message LIKE ?"; countParams.push(`%${search}%`); }
  if (topics) { countQuery += " AND l.topics LIKE ?"; countParams.push(`%${topics}%`); }
  if (topics) { countQuery += " AND l.topics LIKE ?"; countParams.push(`%${topics}%`); }
  if (startDate) { countQuery += " AND l.created_at >= ?"; countParams.push(startDate.replace('T', ' ')); }
  if (endDate) { countQuery += " AND l.created_at <= ?"; countParams.push(endDate.replace('T', ' ')); }
  
  if (isGrouped) {
      countQuery += " GROUP BY l.device_id, l.message, l.topics) as sub";
  }
  
  console.log('Count Query:', countQuery);
  console.log('Count Params:', countParams);

  const [countRows] = await db.query(countQuery, countParams);
  console.log('Count Rows:', countRows);

  process.exit(0);
}

run().catch(console.error);
