import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'monitoring_itats'
  });

  try {
    const dbName = process.env.DB_NAME || 'monitoring_itats';
    console.log(`Using database: ${dbName}`);

    const addColumn = async (table, column, definition) => {
      const [existing] = await db.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        [dbName, table, column]
      );
      if (existing.length === 0) {
        console.log(`Adding ${column}...`);
        await db.query(`ALTER TABLE \`${dbName}\`.\`${table}\` ADD COLUMN ${column} ${definition}`);
      } else {
        console.log(`${column} already exists.`);
      }
    };

    await addColumn('mikrotik_aps', 'mac_address', "VARCHAR(50) UNIQUE AFTER name");
    await addColumn('mikrotik_aps', 'interface_name', "VARCHAR(100) NULL AFTER ip_address");
    await addColumn('mikrotik_aps', 'mode', "VARCHAR(50) DEFAULT 'ap' AFTER interface_name");
    await addColumn('mikrotik_aps', 'status', "VARCHAR(20) DEFAULT 'online' AFTER group_label");
    await addColumn('mikrotik_aps', 'last_client_count', "INT DEFAULT 0 AFTER status");
    await addColumn('mikrotik_aps', 'last_seen', "TIMESTAMP NULL AFTER lng");
    
    console.log('Migration finished successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await db.end();
  }
}

migrate();
