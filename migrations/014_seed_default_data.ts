import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import type { Migration } from './index.js';

export const migration_014: Migration = {
  id: 14,
  name: 'Seed default data',
  up: async (db: mysql.Pool) => {
    // Seed default admin user
    const [users]: any = await db.query('SELECT * FROM admin_users WHERE username = ?', ['admin']);
    if (users.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.query('INSERT INTO admin_users (username, password) VALUES (?, ?)', ['admin', hash]);
      console.log('[Migration 014] Default admin seeded (admin/admin123)');
    }

    // Seed default settings
    const seedSetting = async (key: string, value: string) => {
      const [rows]: any = await db.query('SELECT * FROM system_settings WHERE key_name = ?', [key]);
      if (rows.length === 0) {
        await db.query('INSERT INTO system_settings (key_name, key_value) VALUES (?, ?)', [key, value]);
        console.log(`[Migration 014] Default setting '${key}' seeded`);
      }
    };

    await seedSetting('log_retention_days', '30');
    await seedSetting('ai_analysis_enabled', 'true');
    await seedSetting('notification_polling', '10');
    await seedSetting('simulation_mode', 'false');
    await seedSetting('visual_theme', 'dark');

    console.log('[Migration 014] Default data seeded');
  },
  down: async (db: mysql.Pool) => {
    await db.query("DELETE FROM system_settings WHERE key_name IN ('log_retention_days', 'ai_analysis_enabled', 'notification_polling', 'simulation_mode', 'visual_theme')");
    console.log('[Migration 014] Default data removed');
  }
};