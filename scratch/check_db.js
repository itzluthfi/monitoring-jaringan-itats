import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkDB() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'monitoring_itats'
  });

  try {
    const [columns] = await db.query('SHOW COLUMNS FROM mikrotik_aps');
    console.log('Columns in mikrotik_aps:', columns.map(c => c.Field));
    
    const [rows] = await db.query('SELECT COUNT(*) as count FROM mikrotik_aps');
    console.log('Row count in mikrotik_aps:', rows[0].count);

    const [aps] = await db.query('SELECT * FROM mikrotik_aps LIMIT 3');
    console.log('Sample APs:', JSON.stringify(aps, null, 2));

  } catch (err) {
    console.error('Error checking DB:', err.message);
  } finally {
    await db.end();
  }
}

checkDB();
