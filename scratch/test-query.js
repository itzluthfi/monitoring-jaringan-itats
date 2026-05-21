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

  console.log('Columns in mikrotik_devices:');
  const [columns] = await db.query('SHOW COLUMNS FROM mikrotik_devices');
  console.log(columns);

  console.log('\nAll devices and logs_enabled:');
  const [rows] = await db.query('SELECT id, name, logs_enabled FROM mikrotik_devices');
  console.log(rows);

  process.exit(0);
}

run().catch(console.error);
