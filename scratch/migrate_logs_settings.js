import { db } from '../server/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  try {
    console.log("Running Migration...");
    
    // 1. Add logs_enabled to mikrotik_devices if missing
    const dbName = process.env.DB_NAME || 'monitoring_itats';
    const resultCol = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [dbName, 'mikrotik_devices', 'logs_enabled']
    );
    const existingCol = resultCol[0];
    
    if (!existingCol || existingCol.length === 0) {
      console.log("Adding logs_enabled to mikrotik_devices...");
      await db.query(`ALTER TABLE mikrotik_devices ADD COLUMN logs_enabled TINYINT DEFAULT 1 AFTER port`);
    } else {
      console.log("logs_enabled already exists.");
    }

    // 2. Create system_settings table
    console.log("Creating system_settings table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        key_name VARCHAR(100) UNIQUE,
        key_value VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 3. Seed default log_retention_days
    const resultSettings = await db.query('SELECT * FROM system_settings WHERE key_name = ?', ['log_retention_days']);
    const settings = resultSettings[0];
    if (!settings || settings.length === 0) {
      console.log("Seeding log_retention_days default (30)...");
      await db.query('INSERT INTO system_settings (key_name, key_value) VALUES (?, ?)', ['log_retention_days', '30']);
    } else {
      console.log("log_retention_days already seeded.");
    }

    console.log("Migration finished successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
