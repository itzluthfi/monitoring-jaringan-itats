import { db } from './server/db.js';

async function migrate() {
  try {
    const dbName = process.env.DB_NAME || 'monitoring_itats';
    console.log(`Checking for 'level' column in ${dbName}.mikrotik_devices...`);
    
    const [existing]: any = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [dbName, 'mikrotik_devices', 'level']
    );

    if (existing.length === 0) {
      console.log("Adding 'level' column...");
      await db.query(`ALTER TABLE \`${dbName}\`.mikrotik_devices ADD COLUMN level INT DEFAULT NULL AFTER lng`);
      console.log("Success!");
    } else {
      console.log("Column 'level' already exists.");
    }
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

migrate();
