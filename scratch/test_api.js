import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkApi() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'monitoring_itats'
  });

  try {
    const query = "SELECT a.*, m.name as mikrotik_name FROM mikrotik_aps a LEFT JOIN mikrotik_devices m ON a.mikrotik_id = m.id ORDER BY m.name, a.group_label, a.name";
    const [rows] = await db.query(query);
    console.log(`API would return ${rows.length} rows.`);
    if (rows.length > 0) {
      console.log('First result:', JSON.stringify(rows[0], null, 2));
    }
  } catch (err) {
    console.error('API Query failed:', err.message);
  } finally {
    await db.end();
  }
}

checkApi();
